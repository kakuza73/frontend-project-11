/* eslint-disable no-param-reassign */

import axios from 'axios';
import i18next from 'i18next';
import onChange from 'on-change';
import { string, setLocale } from 'yup';
import { differenceWith, uniqueId } from 'lodash';

import render from './view.js';
import parse from './parser.js';
import resources from './locales/index.js';

const validate = (currentURL, previousURLs) => {
  const schema = string().url().required().notOneOf(previousURLs);
  return schema
    .validate(currentURL)
    .then(() => null)
    .catch((error) => error.message);
};

const loadFeed = (url, state) => {
  state.loadingProcess.status = 'loading';
  return axios
    .get(`https://allorigins.hexlet.app/get?disableCache=true&url=${url}`)
    .then((response) => {
      const { title, description, posts } = parse(response.data.contents);
      const feed = {
        id: uniqueId(),
        url,
        title,
        description,
      };
      const postsList = posts.map((post) => ({
        ...post,
        id: uniqueId(),
        feedId: feed.id,
      }));

      state.feeds.unshift(feed);
      state.posts.unshift(...postsList);
      state.loadingProcess.status = 'success';
      state.loadingProcess.error = null;
    })
    .catch((error) => {
      const errorType = error.isAxiosError ? 'errNet' : 'parserError';
      state.loadingProcess.status = 'failed';
      state.loadingProcess.error = errorType;
    });
};

const updateFeeds = (state) => {
  const promises = state.feeds.map(({ url, id }) =>
    axios.get(`https://allorigins.hexlet.app/get?disableCache=true&url=${url}`)
      .then((response) => {
        const currentPosts = state.posts.filter(({ feedId }) => feedId === id);
        const loadedPosts = parse(response.data.contents).posts.map((post) => ({
          ...post,
          feedId: id,
        }));
        const newPosts = differenceWith(
          loadedPosts,
          currentPosts,
          (loadedPost, currentPost) => loadedPost.title === currentPost.title,
        ).map((post) => ({ ...post, id: uniqueId() }));

        state.posts.unshift(...newPosts);
      })
  );

  Promise.all(promises).finally(() => {
    setTimeout(() => updateFeeds(state), 5000);
  });
};

export default () => {
  const initialState = {
    feeds: [],
    posts: [],
    loadingProcess: {
      status: 'idle',
      error: null,
    },
    form: {
      error: null,
      valid: false,
    },
    modal: {
      postId: null,
    },
    ui: {
      seenPosts: new Set(),
    },
  };

  const elements = {
    form: document.querySelector('.rss-form'),
    feedback: document.querySelector('.feedback'),
    input: document.getElementById('url-input'),
    submitButton: document.querySelector('button[type="submit"]'),
    rssFeeds: document.querySelector('.feeds'),
    rssPosts: document.querySelector('.posts'),
    modal: document.querySelector('#modal'),
  };

  const local = i18next.createInstance();

  local
    .init({
      lng: 'ru',
      debug: false,
      resources,
    })
    .then(() => {
      setLocale({
        string: {
          url: 'notURL',
        },
        mixed: {
          required: 'required',
          notOneOf: 'exists',
        },
      });

      const state = onChange(initialState, render(elements, initialState, local));

      elements.form.addEventListener('submit', (event) => {
        event.preventDefault();

        const currentURL = new FormData(event.target).get('url');
        const previousURLs = state.feeds.map(({ url }) => url);

        validate(currentURL, previousURLs)
          .then((error) => {
            if (error) {
              state.form = { valid: false, error };
              return;
            }

            state.form = { valid: true, error: null };
            loadFeed(currentURL, state);
          });
      });

      elements.rssPosts.addEventListener('click', ({ target }) => {
        if (!('id' in target.dataset)) {
          return;
        }

        const { id } = target.dataset;
        state.modal.postId = id;
        state.ui.seenPosts.add(id);
      });

      setTimeout(() => updateFeeds(state), 5000);
    });
};
