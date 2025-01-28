/* eslint no-param-reassign: "error" */

import 'bootstrap/js/dist/modal.js';
import { differenceWith, isEmpty, uniqueId } from 'lodash';
import * as yup from 'yup';
import i18next from 'i18next';
import axios from 'axios';
import processStates from './states.js';
import resources from './locales/index.js';
import watcher from './watcher.js';
import parser from './parser.js';

const validation = (url, uniqueUrl) => {
  const scheme = yup
    .string()
    .trim()
    .required()
    .url()
    .notOneOf(uniqueUrl);

  return scheme.validate(url);
};

const getProxyUrl = (url) => {
  const baseUrl = 'https://allorigins.hexlet.app/get';

  const proxyUrl = new URL(baseUrl);
  proxyUrl.searchParams.set('disableCache', 'true');
  proxyUrl.searchParams.set('url', url);

  return proxyUrl.toString();
};

const loadUrlData = (url) => axios.get(getProxyUrl(url), { timeout: 5000 })
  .then((res) => parser(res.data.contents));

const normalizeFeed = (feed) => ({
  ...feed,
  id: uniqueId(),
});

const normalizePost = (posts, options = {}) => posts.map((post) => ({
  ...post,
  id: uniqueId(),
  ...options,
}));

const postRss = (url, watchedState) => loadUrlData(url)
  .then(({ title, description, items }) => {
    const normalizedFeed = normalizeFeed({ title, description });
    const normalizedPost = normalizePost(items, { feedId: normalizedFeed.id });

    watchedState.processStateError = null;
    watchedState.processState = processStates.finished;
    watchedState.rssUrls = [url, ...watchedState.rssUrls];
    watchedState.feeds = [normalizedFeed, ...watchedState.feeds];
    watchedState.posts = [...normalizedPost, ...watchedState.posts];
    watchedState.form.processState = processStates.finished;
  }).catch((e) => {
    if (e.isAxiosError) {
      watchedState.processStateError = 'errors.app.network';
    } else if (e.isParseError) {
      watchedState.processStateError = 'errors.app.rssParser';
    } else {
      watchedState.processStateError = 'errors.app.unknown';
      console.error(`Unknown error type: ${e.message}.`);
    }

    watchedState.processState = processStates.failed;
    watchedState.form.processState = processStates.initial;
  });

const loadNewPosts = (watchedState) => {
  const request = watchedState.rssUrls.map((url) => loadUrlData(url));
  return Promise.all(request)
    .then((responce) => responce.flatMap(({ items }, index) => {
      const curFeed = watchedState.feeds[index];
      return normalizePost(items, { feedId: curFeed.id });
    }));
};

const listenToNewPosts = (watchedState) => {
  const timeoutMs = 5000;

  loadNewPosts(watchedState)
    .then((newPosts) => {
      const newUPosts = differenceWith(
        newPosts,
        watchedState.posts,
        (newPost, oldPost) => newPost.title === oldPost.title,
      );

      if (isEmpty(newUPosts)) {
        return;
      }

      watchedState.posts = [...newUPosts, ...watchedState.posts];
    })
    .finally(() => {
      setTimeout(listenToNewPosts, timeoutMs, watchedState);
    });
};

export default () => {
  const defaultLanguage = 'ru';

  const state = {
    rssUrls: [],
    feeds: [],
    posts: [],
    processStateError: null,
    processState: processStates.initial,
    form: {
      valid: true,
      processStateError: null,
      processState: processStates.initial,
    },
    uiState: {
      viewedPostsIds: new Set(),
      previewPostId: null,
    },
  };

  const elements = {
    feedForm: {
      form: document.querySelector('.rss-form'),
      input: document.querySelector('[name="add-rss"]'),
      submitButton: document.querySelector('button[type="submit"]'),
    },
    messageContainer: document.querySelector('.message-container'),

    feedsContainer: document.querySelector('.feeds'),
    postsContainer: document.querySelector('.posts'),


    postPreviewModal: {
      title: document.querySelector('#postPreviewModal .modal-title'),
      body: document.querySelector('#postPreviewModal .modal-body'),
      closeButton: document.querySelector('#postPreviewModal .modal-footer [data-bs-dismiss]'),
      readMoreLink: document.querySelector('#postPreviewModal .modal-footer [data-readmore]'),
    },
  };

  const i18nextInstance = i18next.createInstance();

  yup.setLocale(resources.yup);

  return i18nextInstance.init({
    lng: defaultLanguage,
    resources: { ru: resources.ru },
  }).then(() => {
    const watchedState = watcher(state, elements, i18nextInstance);

    elements.postsContainer.addEventListener('click', (event) => {
      const previewPostId = event.target.dataset.postId;

      if (!previewPostId) {
        return;
      }

      event.preventDefault();

      watchedState.uiState.previewPostId = previewPostId;
      watchedState.uiState.viewedPostsIds = watchedState.uiState
        .viewedPostsIds.add(previewPostId);
    });

    elements.feedForm.form.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(event.target);
      const rssUrl = formData.get('add-rss');

      watchedState.processStateError = null;
      watchedState.processState = processStates.initial;
      watchedState.form.valid = true;
      watchedState.form.processStateError = null;
      watchedState.form.processState = processStates.sending;

      validation(rssUrl, watchedState.rssUrls)
        .then(() => {
          postRss(rssUrl, watchedState);
        }).catch((e) => {
          watchedState.form.valid = false;
          watchedState.form.processStateError = e.message;
          watchedState.form.processState = processStates.failed;
        });
    });

    listenToNewPosts(watchedState);
  });
};
