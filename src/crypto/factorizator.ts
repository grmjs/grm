import { modExp } from "../helpers.ts";
import { bigInt, BigInteger } from "../../deps.ts";

export class Factorizator {
  static gcd(a: BigInteger, b: BigInteger) {
    while (b.neq(BigInteger.zero)) {
      const temp = b;
      b = a.remainder(b);
      a = temp;
    }
    return a;
  }

  static factorize(pq: BigInteger) {
    if (pq.remainder(2).equals(BigInteger.zero)) {
      return { p: bigInt(2), q: pq.divide(bigInt(2)) };
    }
    let y = BigInteger.randBetween(bigInt(1), pq.minus(1));
    const c = BigInteger.randBetween(bigInt(1), pq.minus(1));
    const m = BigInteger.randBetween(bigInt(1), pq.minus(1));

    let g = BigInteger.one;
    let r = BigInteger.one;
    let q = BigInteger.one;
    let x = BigInteger.zero;
    let ys = BigInteger.zero;
    let k;

    while (g.eq(BigInteger.one)) {
      x = y;
      for (let i = 0; bigInt(i).lesser(r); i++) {
        y = modExp(y, bigInt(2), pq).add(c).remainder(pq);
      }
      k = BigInteger.zero;

      while (k.lesser(r) && g.eq(BigInteger.one)) {
        ys = y;
        const condition = BigInteger.min(m, r.minus(k));
        for (let i = 0; bigInt(i).lesser(condition); i++) {
          y = modExp(y, bigInt(2), pq).add(c).remainder(pq);
          q = q.multiply(x.minus(y).abs()).remainder(pq);
        }
        g = Factorizator.gcd(q, pq);
        k = k.add(m);
      }

      r = r.multiply(2);
    }

    if (g.eq(pq)) {
      while (true) {
        ys = modExp(ys, bigInt(2), pq).add(c).remainder(pq);
        g = Factorizator.gcd(x.minus(ys).abs(), pq);

        if (g.greater(1)) {
          break;
        }
      }
    }
    const p = g;
    q = pq.divide(g);
    return p < q ? { p: p, q: q } : { p: q, q: p };
  }
}
