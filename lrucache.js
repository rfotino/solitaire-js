/**
 * Least-recently-used cache using a Map(), relying
 * on the fact that ES6 Maps maintain insertion order
 * of keys. This will give O(logn) has/add operations.
 *
 * Typically I would use a doubly linked list and a
 * hashmap to get O(1) get/set, but as far as I know
 * there's no native hash map implementation in JavaScript
 * (ES6 Map uses a binary search tree as far as I can
 * tell) and it's not worth it to roll my own hash map here.
 *
 * Note: This is a specialized implementation for my use
 * case where I only want to check if something is in
 * the cache, or add to the cache. There are only dummy
 * values stored in the map and the names are a little
 * unusual, not get/set.
 */
class LRUCache {
  constructor(maxSize = 1) {
    this.maxSize = maxSize;
    this._cache = new Map();
  }

  /**
   * Returns true and updates the used time if the cache
   * contains the key, return false otherwise.
   */
  has(key) {
    if (this._cache.has(key)) {
      this._cache.delete(key);
      this._cache.set(key, 0);
      return true;
    } else {
      return false;
    }
  }

  /**
   * Inserts the key as the newest, or refreshes used time
   * if already in the cache. Evicts the oldest element
   * if the insertion would push it over the max size.
   */
  add(key) {
    if (this._cache.has(key)) {
      this._cache.delete(key);
    } else if (this._cache.size >= this.maxSize) {
      this._cache.delete(this._cache.keys().next().value);
    }
    this._cache.set(key, 0);
  }

  /**
   * Get size of underlying map.
   */
  get size() {
    return this._cache.size;
  }
}

exports.LRUCache = LRUCache;
