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
  return schema.validate(currentURL);
};

const updateFeeds = async (state) => {
  try {
    const promises = state.feeds.map(async ({ url, id }) => {
      const response = await axios.get(`https://allorigins.hexlet.app/get?disableCache=true&url=${url}`);
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

      state.posts = [...newPosts, ...state.posts];
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error updating feeds:', error);
  } finally {
    setTimeout(() => updateFeeds(state), 5000);
  }
};


const errorState = (error, state) => {
  let updatedState = { ...state }; // Clone state to avoid direct mutation
  switch (error.name) {
    case 'ValidationError':
      updatedState = {
        ...updatedState,
        form: { ...updatedState.form, valid: false, error: error.message },
      };
      break;

    case 'parserError':
      updatedState = {
        ...updatedState,
        loadingProcess: { error: 'noRSS', status: 'failed' },
      };
      break;

    case 'AxiosError':
      updatedState = {
        ...updatedState,
        loadingProcess: { error: 'errNet', status: 'failed' },
      };
      break;

    default:
      updatedState = {
        ...updatedState,
        loadingProcess: { error: 'unknown', status: 'failed' },
      };
      break;
  }
  return updatedState; // Return the updated state
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

      const state = onChange(
        initialState,
        render(elements, initialState, local),
      );

      elements.form.addEventListener('submit', (event) => {
        event.preventDefault();

        const currentURL = new FormData(event.target).get('url');
        const previousURLs = state.feeds.map(({ url }) => url);

        validate(currentURL, previousURLs)
          .then(() => {
            const updatedState = {
              ...state,
              form: { ...state.form, valid: true, error: null },
              loadingProcess: { status: 'loading', error: null },
            };
            return axios.get(
              `https://allorigins.hexlet.app/get?disableCache=true&url=${currentURL}`,
            ).then((response) => {
              const { title, description, posts } = parse(response.data.contents);
              const feed = {
                id: uniqueId(),
                url: currentURL,
                title,
                description,
              };
              const postsList = posts.map((post) => ({
                ...post,
                id: uniqueId(),
                feedId: feed.id,
              }));

              return {
                ...updatedState,
                feeds: [feed, ...updatedState.feeds],
                posts: [...postsList, ...updatedState.posts],
                loadingProcess: { error: null, status: 'success' },
              };
            });
          })
          .catch((error) => {
            const updatedState = errorState(error, state);
            return updatedState; // Use the returned updated state
          });
      });

      elements.rssPosts.addEventListener('click', ({ target }) => {
        if (!('id' in target.dataset)) {
          return;
        }

        const { id } = target.dataset;

        state.ui.seenPosts.add(id);
        state.modal.postId = id; // Directly modify the state

        // No return needed here
      });

      setTimeout(() => updateFeeds(state), 5000);
    });
};
