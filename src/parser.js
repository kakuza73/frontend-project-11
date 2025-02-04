/* eslint-disable no-undef */
const getProxy = (url) => {
	const proxy = new URL('get', 'https://allorigins.hexlet.app');
	proxy.searchParams.set('url', url);
	proxy.searchParams.set('disableCache', true);
	return proxy.toString();
};

const parseRss = (xmlString) => {
	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

	const errorNode = xmlDoc.querySelector('parsererror');
	if (errorNode) {
		throw new Error('feedback.parseError');
	}
	const feedTitle = xmlDoc.querySelector('channel > title').textContent;
	const feedDescription = xmlDoc.querySelector('channel > description').textContent;
	const feed = {
		title: feedTitle,
		description: feedDescription,
	};
	const items = Array.from(xmlDoc.querySelectorAll('item')).map((item) => {
		const title = item.querySelector('title').textContent;
		const link = item.querySelector('link').textContent;
		const description = item.querySelector('description').textContent;
		return { title, link, description };
	});

	return { feed, posts: items };
};


export default { getProxy, parseRss };