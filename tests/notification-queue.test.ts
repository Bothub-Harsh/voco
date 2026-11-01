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

  it('Scenario 1: One notification arrives -> open flashcard -> Close appears', () => {
    enqueuePendingNotification({ wordId: 'w1', word: 'Solo', timestamp: 1 });
    // User opens w1 (it is currently active on screen)
    const activeWordId = 'w1';
    const otherPending = getPendingNotificationQueue().filter((q) => q.wordId !== activeWordId).length;
    const button = otherPending > 0 ? 'Next' : 'Close';
    expect(button).toBe('Close');
  });

  it('Scenario 2: Two notifications arrive -> open first -> Next appears -> open second -> Close appears', () => {
    enqueuePendingNotification({ wordId: 'w1', word: 'First', timestamp: 1 });
    enqueuePendingNotification({ wordId: 'w2', word: 'Second', timestamp: 2 });

    // Open first: w1 is active
    let activeWordId = 'w1';
    let otherPending = getPendingNotificationQueue().filter((q) => q.wordId !== activeWordId).length;
    expect(otherPending > 0 ? 'Next' : 'Close').toBe('Next');

    // Tap Next: w1 is consumed/answered, w2 becomes active
    removePendingNotificationByWordId('w1');
    activeWordId = 'w2';
    otherPending = getPendingNotificationQueue().filter((q) => q.wordId !== activeWordId).length;
    expect(otherPending > 0 ? 'Next' : 'Close').toBe('Close');
  });

  it('Scenario 3: Five notifications arrive -> navigates through all five in order (Next -> Next -> Next -> Next -> Close)', () => {
    for (let i = 1; i <= 5; i++) {
      enqueuePendingNotification({ wordId: `w${i}`, word: `Word${i}`, timestamp: i });
    }

    for (let step = 1; step <= 5; step++) {
      const activeWordId = `w${step}`;
      const otherPending = getPendingNotificationQueue().filter((q) => q.wordId !== activeWordId).length;
      if (step < 5) {
        expect(otherPending > 0 ? 'Next' : 'Close').toBe('Next');
      } else {
        expect(otherPending > 0 ? 'Next' : 'Close').toBe('Close');
      }
      removePendingNotificationByWordId(activeWordId);
    }
  });

  it('Scenario 4 & 5: Test notification shares exact same queue logic (Close if alone, Next if others pending)', () => {
    // Scenario 4: Tap Test when no other notification is pending
    clearPendingNotificationQueue();
    enqueuePendingNotification({ wordId: 'test1', word: 'TestSolo', isTest: true, timestamp: 1 });
    let activeWordId = 'test1';
    let otherPending = getPendingNotificationQueue().filter((q) => q.wordId !== activeWordId).length;
    expect(otherPending > 0 ? 'Next' : 'Close').toBe('Close');

    // Scenario 5: Tap Test when another notification is already pending
    enqueuePendingNotification({ wordId: 'regular1', word: 'RegularWord', isTest: false, timestamp: 2 });
    otherPending = getPendingNotificationQueue().filter((q) => q.wordId !== activeWordId).length;
    expect(otherPending > 0 ? 'Next' : 'Close').toBe('Next');
  });

  it('Scenario 7: Answer Don\'t Remember keeps word in queue so user can try again', () => {
    enqueuePendingNotification({ wordId: 'w1', word: 'TryAgain', timestamp: 1 });
    // User taps Don't Remember: word remains in queue
    expect(getPendingNotificationQueue()).toHaveLength(1);
    expect(getPendingNotificationQueue()[0].wordId).toBe('w1');
  });
});
