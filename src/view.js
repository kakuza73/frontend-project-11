import onChange from 'on-change';

const renderErrorss = (elements, i18n, value) => {
  const { t } = i18n;

  const { feedback } = elements;

  if(value === null) {
    return;
  }

  switch (value) {
    case 'feedback.invalidUrl':
      feedback.textContent = t(value);
      break;

    case 'feedback.conflict':
      feedback.textContent = t(value);
      break;

    case 'feedback.invalidRss':
      feedback.textContent = t(value);
      break;

      default:
        break;
  }
};

export default (elements, i18n, state) => {
  //const { form, fields, errorFields } = elements;
  const formProcess = onChange(state, (path, value) => {
  switch (path) {
      case 'form.errors':
        renderErrorss(elements, i18n, value);
        break;

      default:
        break;

    }
  });

  return formProcess;
};