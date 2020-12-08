import tape from 'tape-catch';
import NodeImpressionObserverFactory from '../node';
import { generateImpressions } from './testUtils';

tape('Node JS / Impression Observer Basic Functionality', assert => {
  const observer = NodeImpressionObserverFactory();

  const imp = {
    keyName: 'someKey',
    feature: 'someFeature',
    label: 'in segment all',
    changeNumber: 123,
    time: Date.now(),
  };

  // Add 5 new impressions so that the old one is evicted and re-try the test.
  generateImpressions(5).forEach(ki => {
    observer.testAndSet(ki);
  });

  assert.is(observer.testAndSet(imp), undefined);
  assert.equal(observer.testAndSet(imp), imp.time);

  assert.end();
});
