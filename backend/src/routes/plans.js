import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, description, price_cents, duration_minutes, speed_limit_kbps
       FROM plans WHERE active = true ORDER BY price_cents ASC`
    );
    res.json({ plans: rows });
  } catch (e) { next(e); }
});

export default router;
