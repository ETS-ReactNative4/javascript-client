import { Types, errorParser, messageParser } from './notificationparser';

// @TODO logging
export default function NotificationProcessorFactory(feedbackLoop, splitKeyHashes) {
  return {
    handleOpen() {
      // @REVIEW: call handleEvent({type: Types.STREAMING_UP}); // or Types.STREAMING_RECONNECTED according to spec
      feedbackLoop.stopPollingAndSyncAll();
    },

    handleClose() {
      // @REVIEW: call handleEvent({type: Types.STREAMING_DOWN});
      feedbackLoop.startPolling();
    },

    handleError(error) {
      const errorData = errorParser(error);
      // @TODO logic of NotificationManagerKeeper
      this.handleEvent(errorData);
    },

    handleMessage(message) {
      const messageData = messageParser(message);
      // @TODO logic of NotificationManagerKeeper
      this.handleEvent(messageData, message.channel);
    },

    handleEvent(eventData, channel) {
      switch (eventData.type) {
        case Types.SPLIT_UPDATE:
          feedbackLoop.queueSyncSplits(
            eventData.changeNumber);
          break;
        case Types.SEGMENT_UPDATE:
          feedbackLoop.queueSyncSegments(
            eventData.changeNumber,
            eventData.segmentName);
          break;
        case Types.MY_SEGMENTS_UPDATE: {
          // @TODO test the following way to get the splitKey from the channel hash
          const splitKeyHash = channel.split('_')[2];
          const splitKey = splitKeyHashes[splitKeyHash];
          feedbackLoop.queueSyncMySegments(
            eventData.changeNumber,
            splitKey,
            eventData.includesPayload ? eventData.segmentList : undefined);
          break;
        }
        case Types.SPLIT_KILL:
          feedbackLoop.queueKillSplit(
            eventData.changeNumber,
            eventData.splitName,
            eventData.defaultTreatment);
          break;
        // @REVIEW do we need to close the connection if STREAMING_DOWN?
        case Types.STREAMING_DOWN:
          feedbackLoop.startPolling();
          break;
        case Types.STREAMING_UP:
          feedbackLoop.stopPollingAndSyncAll();
          break;
        // @REVIEW is there some scenario where we should consider a DISCONNECT event type?
        case Types.RECONNECT:
          feedbackLoop.reconnectPush();
          break;
      }
    }
  };
}