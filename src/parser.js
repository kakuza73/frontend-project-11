export default (response) => {
  const parser = new DOMParser();
  const content = parser.parseFromString(response, 'text/xml');
  const error = content.querySelector('parsererror');

  if (error) {
    const parserError = new Error(error.textContent);

    parserError.name = 'parserError';

    throw parserError;
  }

  return {
    title: content.querySelector('title').textContent,
    description: content.querySelector('description').textContent,
    posts: [...content.querySelectorAll('item')].map((post) => ({
      title: post.querySelector('title').textContent,
      description: post.querySelector('description').textContent,
      link: post.querySelector('link').textContent,
    })),
  };
};
