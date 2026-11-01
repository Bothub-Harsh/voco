import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPendingNotificationQueue,
  enqueuePendingNotification,
  dequeuePendingNotification,
  removePendingNotificationByWordId,
  clearPendingNotificationQueue,
} from '../src/services/notifications';

describe('Smart Notification Queue', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, String(val)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage;
    clearPendingNotificationQueue();
  });

  it('enqueues multiple incoming notifications in order', () => {
    enqueuePendingNotification({
      notificationId: 50001,
      wordId: 'w1',
      word: 'Resilient',
      timestamp: 1000,
    });
    enqueuePendingNotification({
      notificationId: 50002,
      wordId: 'w2',
      word: 'Benevolent',
      timestamp: 2000,
    });
    enqueuePendingNotification({
      notificationId: 50003,
      wordId: 'w3',
      word: 'Diligent',
      timestamp: 3000,
    });

    const queue = getPendingNotificationQueue();
    expect(queue).toHaveLength(3);
    expect(queue[0].word).toBe('Resilient');
    expect(queue[1].word).toBe('Benevolent');
    expect(queue[2].word).toBe('Diligent');
  });

  it('prevents duplicate word entries by updating at tail', () => {
    enqueuePendingNotification({
      notificationId: 50001,
      wordId: 'w1',
      word: 'Ponder',
      timestamp: 1000,
    });
    enqueuePendingNotification({
      notificationId: 50002,
      wordId: 'w2',
      word: 'Elated',
      timestamp: 2000,
    });
    // Re-enqueue w1 with newer notification
    enqueuePendingNotification({
      notificationId: 50003,
      wordId: 'w1',
      word: 'Ponder',
      timestamp: 3000,
    });

    const queue = getPendingNotificationQueue();
    expect(queue).toHaveLength(2);
    expect(queue[0].wordId).toBe('w2');
    expect(queue[1].wordId).toBe('w1');
    expect(queue[1].notificationId).toBe(50003);
  });

  it('dequeues in FIFO order when no specific wordId is provided', () => {
    enqueuePendingNotification({ wordId: 'w1', word: 'One', timestamp: 1 });
    enqueuePendingNotification({ wordId: 'w2', word: 'Two', timestamp: 2 });

    const first = dequeuePendingNotification();
    expect(first?.wordId).toBe('w1');

    const remaining = getPendingNotificationQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].wordId).toBe('w2');
  });

  it('dequeues specific target wordId when tapped from notification shade', () => {
    enqueuePendingNotification({ wordId: 'w1', word: 'One', timestamp: 1 });
    enqueuePendingNotification({ wordId: 'w2', word: 'Two', timestamp: 2 });
    enqueuePendingNotification({ wordId: 'w3', word: 'Three', timestamp: 3 });

    // User taps notification for w2
    const targeted = dequeuePendingNotification('w2');
    expect(targeted?.wordId).toBe('w2');

    const remaining = getPendingNotificationQueue();
    expect(remaining).toHaveLength(2);
    expect(remaining.map((q) => q.wordId)).toEqual(['w1', 'w3']);
  });

  it('removes pending notifications by wordId', () => {
    enqueuePendingNotification({ wordId: 'del1', word: 'DeleteMe', timestamp: 1 });
    enqueuePendingNotification({ wordId: 'keep1', word: 'KeepMe', timestamp: 2 });

    removePendingNotificationByWordId('del1');

    const remaining = getPendingNotificationQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].wordId).toBe('keep1');
  });

  it('determines Next vs Close button state based on remaining pending notifications', () => {
    enqueuePendingNotification({ wordId: 'w1', word: 'First', timestamp: 1 });
    enqueuePendingNotification({ wordId: 'w2', word: 'Second', timestamp: 2 });

    // User is practicing w1, so w1 was popped. Queue now has w2.
    dequeuePendingNotification('w1');
    let remaining = getPendingNotificationQueue().length;
    // More than one total originally, 1 still pending: button should be "Next"
    let buttonLabel = remaining > 0 ? 'Next' : 'Close';
    expect(buttonLabel).toBe('Next');

    // User answers w2
    dequeuePendingNotification('w2');
    remaining = getPendingNotificationQueue().length;
    buttonLabel = remaining > 0 ? 'Next' : 'Close';
    expect(buttonLabel).toBe('Close');
  });
});
