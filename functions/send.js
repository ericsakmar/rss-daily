const fetch = require("node-fetch");
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const feedlyUserId = process.env.FEEDLY_USER_ID;
const feedlyToken = process.env.FEEDLY_TOKEN;
const clientToken = process.env.RSS_DAILY_CLIENT_TOKEN;

const style = `
  font-family: monospace;
`;

const getUnread = async () => {
  const url = `https://cloud.feedly.com/v3/streams/contents?streamId=user/${feedlyUserId}/category/global.all&unreadOnly=true`;
  const res = await fetch(url, { headers: { Authorization: feedlyToken } });
  const full = await res.json();
  return full.items;
};

const markAsRead = async (articles) => {
  const url = `https://cloud.feedly.com/v3/markers`;

  const entryIds = articles.map((a) => a.id);

  const body = {
    entryIds,
    action: "markAsRead",
    type: "entries",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: feedlyToken },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error("Unable to mark items as read.");
  }
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
    const articles = grouped[source].sort(
      (a, b) => parseInt(a.published, 10) - parseInt(b.published, 10)
    );

    const links = articles
      .map(
        (a) => `<li><a href="${a.canonicalUrl || a.originId}">${a.title}</li>`
      )
      .join(" ");

    const linkList = `<ul>${links}</ul>`;

    return `<div><h2>${source}</h2>${linkList}</div>`;
  });

  return `
    <div style="${style}">
      <h1>RSS Daily!</h1>
      ${divs.join(" ")}
    </div>
  `;
};

const sendMail = async (html) => {
  const msg = {
    html,
    to: "eric.sakmar+rss@gmail.com",
    from: "eric.sakmar+rss@gmail.com",
    subject: "RSS Daily",
    text: "todo",
  };

  await sgMail.send(msg);
};

const main = async () => {
  try {
    const articles = await getUnread();
    const grouped = group(articles);
    const html = toHtml(grouped);
    await sendMail(html);
    await markAsRead(articles);
  } catch (e) {
    const errorHtml = `
      <div style="${style}">
        <h1>RSS Daily Had a Problem!</h1>
        <pre>${e}</pre>
      </div>
    `;
    await sendMail(errorHtml);
  }
};

exports.handler = function (event, _context, callback) {
  if (event.headers.authorization !== clientToken) {
    callback(null, {
      statusCode: 403,
      body: "not ok",
    });
    return;
  }

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
