function parseEvent(event) {
  const eventDataStringified = event.Records[0].body;
  const eventData = JSON.parse(eventDataStringified);
  return eventData;
}

module.exports = {
  parseEvent,
};
