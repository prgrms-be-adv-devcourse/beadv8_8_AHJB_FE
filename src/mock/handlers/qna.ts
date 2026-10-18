import { db, nextId, persist } from '../db';
import { fail } from '../errors';
import { noContent, ok, route } from '../router';
import { findProduct, requireMe } from '../services';
import type { QnaRecord } from '../types';
import { formatLocalDateTime as ldt, getPageParams, numberOr } from '../utils';
import { toQnaView } from '../views';

interface QnaBody {
  content: string;
  parentId: number | null;
}

export function registerQnaRoutes(): void {
  /** 질문(최신순) + 답글(오래된순). after 보다 큰 id 의 질문만 */
  route('GET', '/api/v1/products/:id/qnas', (ctx) => {
    const product = findProduct(Number(ctx.pathParams.id));
    const after = numberOr(ctx.params.get('after'), 0);
    const { page, size } = getPageParams(ctx.params, 20);
    const productQnas = db.qnas.filter((q) => q.productId === product.id);
    const threads = productQnas
      .filter((q) => q.parentId === null && q.id > after)
      .sort((a, b) => b.id - a.id)
      .map((question) => ({
        ...toQnaView(question, product.sellerId),
        replies: productQnas
          .filter((q) => q.parentId === question.id)
          .sort((a, b) => a.id - b.id)
          .map((reply) => toQnaView(reply, product.sellerId)),
      }));
    const qnas = threads.slice(page * size, page * size + size);
    const latestQnaId = productQnas.reduce((max, q) => Math.max(max, q.id), 0);
    return ok({ qnas, hasNext: threads.length > page * size + size, latestQnaId: latestQnaId || null });
  });

  route('POST', '/api/v1/products/:id/qnas', (ctx) => {
    const me = requireMe(ctx);
    const product = findProduct(Number(ctx.pathParams.id));
    const body = ctx.body as Partial<QnaBody> | null | undefined;
    const content = String(body?.content ?? '').trim();
    if (!content || content.length > 1000) fail('COMMON001');
    const parentId = body?.parentId ?? null;
    if (parentId !== null) {
      const parent = db.qnas.find((q) => q.id === parentId);
      if (!parent || parent.productId !== product.id || parent.parentId !== null) fail('PRODUCT011');
      if (me.id !== product.sellerId) fail('PRODUCT012');
    }
    const qna: QnaRecord = {
      id: nextId('qnas'),
      productId: product.id,
      parentId,
      writerId: me.id,
      content,
      deleted: false,
      createdAt: ldt(),
      updatedAt: ldt(),
    };
    db.qnas.push(qna);
    persist();
    return ok(toQnaView(qna, product.sellerId), 201);
  });

  route('PATCH', '/api/v1/qnas/:qnaId', (ctx) => {
    const me = requireMe(ctx);
    const qna = db.qnas.find((q) => q.id === Number(ctx.pathParams.qnaId) && !q.deleted);
    if (!qna) fail('PRODUCT009');
    if (qna.writerId !== me.id) fail('PRODUCT010');
    const content = String((ctx.body as Partial<QnaBody> | null | undefined)?.content ?? '').trim();
    if (!content) fail('COMMON001');
    qna.content = content;
    qna.updatedAt = ldt();
    persist();
    return ok(toQnaView(qna, findProduct(qna.productId).sellerId));
  });

  route('DELETE', '/api/v1/qnas/:qnaId', (ctx) => {
    const me = requireMe(ctx);
    const qna = db.qnas.find((q) => q.id === Number(ctx.pathParams.qnaId) && !q.deleted);
    if (!qna) fail('PRODUCT009');
    if (qna.writerId !== me.id) fail('PRODUCT010');
    qna.deleted = true;
    persist();
    return noContent(204);
  });
}
