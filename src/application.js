/* eslint-disable no-undef */
import * as yup from 'yup';
import i18next from 'i18next';
import axios from 'axios';
import resources from './locales/index.js';
import watcher from './view.js';
import { getProxy, parseRss } from './parser.js';

export default async () => {
  const elements = {
    form: document.querySelector('.rss-form'),
    input: document.querySelector('#url-input'),
    submitButton: document.querySelector('button[type="submit"]'),
    feedback: document.querySelector('.feedback'),
    feedsList: document.querySelector('.feeds'),
    postsList: document.querySelector('.posts'),

    fields: {},
    errorFields: {},
  };

  const validate = (url, feeds) => {
    const urlSchema = yup.string().url().required().notOneOf(feeds);
    return urlSchema.validate(url, { abortEarly: false })
  };


  const state = {
    form: {
      status: 'filling',// null неверно
      valid: false,
      errors: null,
    },
    links: [],
    posts: [],
    feeds: [],
  };

  const i18n = i18next.createInstance();
  i18n.init({
    lng: 'ru',
    debug: true,
    resources,
  })
  .then(() => {
    yup.setLocale({
      mixed: {
        required: () => ({ key: 'feedback.notEmpty' }),
        conflict: () => ({ key: 'feedback.conflict' }),
      },
      string: {
        url: () => ({ key: 'feedback.invalidUrl' }),
      },
    });
  })
  /*.then(() => {
    const urlSchema = (addUrl) => yup.object({
        urlRss: yup.string()
            .url()
            .required()
            .notOneOf(addUrl, 'feedback.conflict'),
    });*/

/*const urlSchema = (addUrl) => yup.object({
    urlRss: yup.string()
    .url()
    .required()
    .notOneOf(addUrl),
  });*/




  const watchedState = watcher(elements, i18n, state); // Наблюдаемое состояние

    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
      watchedState.form.status = 'loading';
      watchedState.form.errors = null;

      const formData = new FormData(event.target);
      const url = formData.get('url'); //получаем значение поля формы 'url'.

      validate(url, watchedState.links)
      .then((validUrl) => {
        const rss = axios.get(getProxy(validUrl));
        return rss;
      })

});

};
