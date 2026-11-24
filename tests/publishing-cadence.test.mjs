import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLISHING_CADENCE, minuteDistance, validatePublishingCadence } from '../n8n/publishing-cadence.mjs';

test('publisher polling is staggered without another hourly analytics workflow',()=>{
  assert.equal(minuteDistance(PUBLISHING_CADENCE.reelsPublisher,PUBLISHING_CADENCE.carouselPublisher),10);
  assert.equal(PUBLISHING_CADENCE.analytics.field,'cronExpression');
  assert.equal(PUBLISHING_CADENCE.analytics.expression,'35 2 * * *');
  assert.deepEqual(validatePublishingCadence(),[]);
});

test('overlapping publishers fail cadence validation',()=>{
  const invalid={...PUBLISHING_CADENCE,carouselPublisher:{field:'hours',hoursInterval:1,triggerAtMinute:5}};
  assert.match(validatePublishingCadence(invalid).join(' '),/at least 10 minutes apart/i);
});
