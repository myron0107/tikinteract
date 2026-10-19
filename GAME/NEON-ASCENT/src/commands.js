// Keep replay protection for the whole session. Visual limits must never
// become limits on paid commands. Canonical decimal IDs compact to intervals;
// UUIDs and noncanonical decimal strings retain their exact string identity.
export class CommandIds {
  constructor() { this.local = new Set(); this.ranges = []; }
  numeric(id) { return /^(0|[1-9][0-9]{0,19})$/.test(String(id)) ? BigInt(id) : null; }
  lowerBound(n) {
    let lo = 0, hi = this.ranges.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (this.ranges[mid][1] < n) lo = mid + 1; else hi = mid; }
    return lo;
  }
  has(id) {
    const n = this.numeric(id);
    if (n === null) return this.local.has(String(id));
    const range = this.ranges[this.lowerBound(n)];
    return Boolean(range && range[0] <= n);
  }
  add(id) {
    const n = this.numeric(id);
    if (n === null) {
      this.local.add(String(id)); return;
    }
    let start = n, end = n, at = this.lowerBound(n - 1n);
    let count = 0;
    while (at + count < this.ranges.length && this.ranges[at + count][0] <= end + 1n) {
      const [lo, hi] = this.ranges[at + count]; start = lo < start ? lo : start; end = hi > end ? hi : end; count++;
    }
    this.ranges.splice(at, count, [start, end]);
  }
}
