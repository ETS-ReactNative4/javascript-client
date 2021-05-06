import RedisAdapter from './RedisAdapter';
import SplitCacheInMemory from './SplitCache/InMemory';
import SplitCacheInRedis from './SplitCache/InRedis';
import SegmentCacheInMemory from './SegmentCache/InMemory';
import SegmentCacheInRedis from './SegmentCache/InRedis';
import ImpressionsCacheInMemory from './ImpressionsCache/InMemory';
import ImpressionsCacheInRedis from './ImpressionsCache/InRedis';
import LatencyCacheInMemory from './LatencyCache/InMemory';
import LatencyCacheInRedis from './LatencyCache/InRedis';
import CountCacheInMemory from './CountCache/InMemory';
import CountCacheInRedis from './CountCache/InRedis';
import EventsCacheInMemory from './EventsCache/InMemory';
import EventsCacheInRedis from './EventsCache/InRedis';
import KeyBuilder from './Keys';
import MetaBuilder from './Meta';
import { STORAGE_MEMORY, STORAGE_REDIS, STORAGE_CUSTOM } from '../utils/constants';
import { PluggableStorage } from '@splitsoftware/splitio-commons';
import LogFactory from '../utils/logger';

const NodeStorageFactory = context => {
  const settings = context.get(context.constants.SETTINGS);
  const { storage } = settings;
  const keys = new KeyBuilder(settings);
  const readinessManager = context.get(context.constants.READINESS);
  const meta = MetaBuilder(settings);
  const onReadyCb = () => {
    readinessManager.splits.emit(readinessManager.splits.SDK_SPLITS_ARRIVED);
    readinessManager.segments.emit(readinessManager.segments.SDK_SEGMENTS_ARRIVED);
  };

  switch (storage.type) {
    case STORAGE_REDIS: {
      const redis = new RedisAdapter(storage.options);

      // subscription to Redis connect event in order to emit SDK_READY
      redis.on('connect', onReadyCb);

      return {
        splits: new SplitCacheInRedis(keys, redis),
        segments: new SegmentCacheInRedis(keys, redis),
        impressions: new ImpressionsCacheInRedis(keys, redis, meta),
        metrics: new LatencyCacheInRedis(keys, redis),
        count: new CountCacheInRedis(keys, redis),
        events: new EventsCacheInRedis(keys, redis, meta),

        // When using REDIS we should:
        // 1- Disconnect from the storage
        // 2- Stop sending data to Redis and instance using empty in memory implementation
        destroy() {
          redis.disconnect();

          this.splits = new SplitCacheInMemory;
          this.segments = new SegmentCacheInMemory(keys);
          this.impressions = new ImpressionsCacheInMemory;
          this.metrics = new LatencyCacheInMemory;
          this.count = new CountCacheInMemory;
          this.events = new EventsCacheInMemory(context);
        }
      };
    }

    case STORAGE_CUSTOM: {

      const storageFactory = PluggableStorage(storage);

      const storageFactoryParams = {
        onReadyCb,
        metadata: meta,
        log: LogFactory() // logger instance without TAG. PluggableStorage module handles it.
      };

      return storageFactory(storageFactoryParams);
    }

    case STORAGE_MEMORY:
    default:
      return {
        splits: new SplitCacheInMemory,
        segments: new SegmentCacheInMemory(keys),
        impressions: new ImpressionsCacheInMemory,
        metrics: new LatencyCacheInMemory,
        count: new CountCacheInMemory,
        events: new EventsCacheInMemory(context),

        // When using MEMORY we should flush all the storages and leave them empty
        destroy() {
          this.splits.flush();
          this.segments.flush();
          this.impressions.clear();
          this.metrics.clear();
          this.count.clear();
          this.events.clear();
        }
      };
  }

};

export default NodeStorageFactory;
