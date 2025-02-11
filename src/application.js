import './styles.scss';
import 'bootstrap/dist/js/bootstrap.min.js';
import { uniqueId, differenceBy } from 'lodash';
import { object, string } from 'yup';
import i18next from 'i18next';
import axios from 'axios';
import resources from './locales/index.js';
import parse from './parse.js';
import watch from './view.js';

export default () => {
  const elements = {
    form: document.querySelector('form'),
    input: document.getElementById('url-input'),
    errorMessage: document.querySelector('.text-danger'),
    buttonSubmit: document.querySelector('button[type="submit"]'),
    modal: document.getElementById('modal'),
    rssPosts: document.querySelector('.posts'),
  };

  const state = {
    form: {
      error: null,
      valid: false,
    },
    loadingProcess: {
      status: 'idle',
      error: null,
    },
    rss: {
      feeds: [],
      posts: [],
    },
    ui: {
      checkedPosts: [],
    },
  };

  const controller = (i18n) => {
    const { watchedState } = watch(elements, i18n, state);

    const checkRSSPosts = () => {
      const promises = state.rss.feeds.map((feed) => axios.get(`https://allorigins.hexlet.app/get?disableCache=true&url=${feed.url}`)
        .then((response) => response)
        .catch(() => null));

      Promise.all(promises).then((items) => {
        items.forEach((response) => {
          if (!response) return;
          const { latestPost } = parse(response);
          const statePosts = state.rss.posts;
          if (!differenceBy(statePosts, [latestPost], 'title').length) {
            const newPost = {
              ...latestPost,
              id: uniqueId(),
            };
            state.rss.posts = [newPost, ...state.rss.posts];
            watchedState.loadingProcess.status = 'success';
          }
        });
        watchedState.loadingProcess.status = 'idle';
      }).finally(() => setTimeout(checkRSSPosts, 5000));
    };

    const requestRSS = (url) => {
      watchedState.loadingProcess.status = 'loading';
      axios.get(`https://allorigins.hexlet.app/get?disableCache=true&url=${url}`)
        .then((response) => {
          const parsedData = parse(response);
          if (!parsedData) {
            watchedState.loadingProcess.status = 'fail';
            watchedState.form = { error: 'errorRSS', valid: false };
            return;
          }
          const postsWithIds = parsedData.posts.map((post) => ({
            ...post,
            id: uniqueId(),
          }));
          state.rss.feeds = [...state.rss.feeds, { url, ...parsedData.feed }];
          state.rss.posts = [...postsWithIds, ...state.rss.posts];
          watchedState.loadingProcess.status = 'success';
          watchedState.form = { error: null, valid: true };
        })
        .catch(() => {
          watchedState.loadingProcess.status = 'fail';
          watchedState.form = { error: 'netError', valid: false };
        });
    };

    elements.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const schema = object({
        url: string().url().notOneOf(state.rss.feeds.map((feed) => feed.url)),
      });
      schema.validate(Object.fromEntries(formData))
        .then((item) => requestRSS(item.url))
        .catch((err) => {
          watchedState.form = { error: err.type, valid: false };
        });
    });

    elements.input.addEventListener('input', () => {
      watchedState.loadingProcess.status = 'idle';
    });

    elements.rssPosts.addEventListener('click', (e) => {
      if (e.target.dataset.type) {
        watchedState.ui.checkedPosts = [...state.ui.checkedPosts, e.target.dataset.id];
      }
    });

    checkRSSPosts();
  };

  const local = i18next.createInstance();
  local.init({
    lng: 'ru',
    debug: false,
    resources,
  }).then(() => controller(local))
    .catch(() => { });
};
