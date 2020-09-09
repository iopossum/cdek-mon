import { createMessage } from './response';
const pako = require('pako');

export const eventError = (res, err, end) => {
  res.write("event: eventError\n");
  res.write(`data: ${JSON.stringify(createMessage(err))}\n\n`);
  end && end();
};

export const eventFinish = (res, end) => {
  res.write("event: eventFinish\n");
  end && end();
};

export const eventData = (res, data) => {
  console.log(data)
  const encoded = Buffer.from(pako.deflate(JSON.stringify(data))).toString('base64');
  res.write(`data: ${encoded}\n\n`);
};