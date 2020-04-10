const fetch = require("node-fetch");
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const userId = process.env.FEEDLY_USER_ID;
const token = process.env.FEEDLY_TOKEN;

const getUnread = async () => {
  const url = `https://cloud.feedly.com/v3/streams/contents?streamId=user/${userId}/category/global.all&unreadOnly=true`;
  const res = await fetch(url, { headers: { Authorization: token } });
  const full = await res.json();
  return full.items;
};

const group = (articles) =>
  articles.reduce((acc, a) => {
    const source = a.origin.title;
    if (acc[source] === undefined) {
      acc[source] = [];
    }
    acc[source].push(a);
    return acc;
  }, {});

const toHtml = (grouped) => {
  const sources = Object.keys(grouped).sort();

  const divs = sources.map((source) => {
    const articles = grouped[source];

    const links = articles
      .map(
        (a) => `<li><a href="${a.canonicalUrl || a.originId}">${a.title}</li>`
      )
      .join(" ");

    const linkList = `<ul>${links}</ul>`;

    return `<div><h2>${source}</h2>${linkList}</div>`;
  });

  const style = `
    font-family: monospace;
  `;

  return `
    <div style="${style}">
      <h1>Daily RSS</h1>
      ${divs.join(" ")}
    </div>
  `;
};

const sendMail = async (html) => {
  const msg = {
    html,
    to: "eric.sakmar+rss@gmail.com",
    from: "eric.sakmar+rss@gmail.com",
    subject: "Daily RSS",
    text: "todo",
  };

  await sgMail.send(msg);
};

const main = async () => {
  const articles = await getUnread();
  const grouped = group(articles);
  const html = toHtml(grouped);
  await sendMail(html);
};

exports.handler = function (_event, _context, callback) {
  main().then(() => {
    callback(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      statusCode: 200,
      body: "ok",
    });
  });
};
