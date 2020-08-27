import { createMessage } from './response';

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
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};