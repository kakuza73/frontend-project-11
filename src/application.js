import axios from 'axios';
import i18next from 'i18next';
import { string, setLocale } from 'yup';
import { differenceWith, uniqueId } from 'lodash';

import { watchState } from './view.js';
import parseRSS from './parser.js';
import resources from './locales/index.js';

const validateUrl = (url, previousUrls) => {
  const schema = string().url().required().notOneOf(previousUrls);
  return schema
    .validate(url)
    .then(() => null)
    .catch((error) => error.message);
};

const loadRSS = (url) =>
  axios.get(`https://allorigins.hexlet.app/get?disableCache=true&url=${url}`)
    .then((response) => parseRSS(response.data.contents))
    .catch((error) => {
      switch (error.name) {
        case 'parserError':
          throw new Error('noRSS');
        case 'AxiosError':
          throw new Error('errNet');
        default:
          throw new Error('unknown');
      }
    });

const updateFeeds = (state) => {
  const promises = state.feeds.map(({ url, id }) =>
    loadRSS(url)
      .then(({ posts }) => {
        const currentPosts = state.posts.filter((post) => post.feedId === id);
        const loadedPosts = posts.map((post) => ({
          ...post,
          feedId: id,
        }));

        const newPosts = differenceWith(
          loadedPosts,
          currentPosts,
          (loaded, current) => loaded.title === current.title,
        ).map((post) => ({ ...post, id: uniqueId() }));

        state.posts.unshift(...newPosts);
      })
      .catch(() => { }) // Ignore update errors
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
      error: '',
    },
    form: {
      error: '',
      isValid: false,
    },
    ui: {
      seenPosts: new Set(),
      modalPostId: null,
    },
  };

  const elements = {
    form: document.querySelector('.rss-form'),
    feedback: document.querySelector('.feedback'),
    input: document.getElementById('url-input'),
    submitButton: document.querySelector('.rss-form button[type="submit"]'),
    feeds: document.querySelector('.feeds'),
    posts: document.querySelector('.posts'),
    modal: document.querySelector('#modal'),
  };

  const i18nInstance = i18next.createInstance();

  i18nInstance
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

      const state = watchState(elements, initialState, i18nInstance);

      elements.form.addEventListener('submit', (event) => {
        event.preventDefault();

        const url = new FormData(event.target).get('url');
        const urls = state.feeds.map((feed) => feed.url);

        validateUrl(url, urls)
          .then((error) => {
            if (error) {
              state.form = { ...state.form, isValid: false, error };
              return;
            }

            state.form = { ...state.form, isValid: true, error: '' };
            state.loadingProcess = { status: 'loading', error: '' };

            loadRSS(url)
              .then(({ title, description, posts }) => {
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
                state.loadingProcess = { status: 'success', error: '' };
              })
              .catch((error) => {
                state.loadingProcess = {
                  status: 'failed',
                  error: error.message,
                };
              });
          });
      });

      elements.posts.addEventListener('click', ({ target }) => {
        if (!('id' in target.dataset)) {
          return;
        }

        const { id } = target.dataset;
        state.ui.modalPostId = id;
        state.ui.seenPosts.add(id);
      });

      setTimeout(() => updateFeeds(state), 5000);
    });
};