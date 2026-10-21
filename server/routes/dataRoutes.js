import { Router } from 'express';
import { productRepo } from '../repositories/productRepo.js';

const router = Router();

/**
 * GET /api/data
 * Paginated query against the SQLite / database store.
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 100, search = '', sort = '', direction = 'asc' } = req.query;
    const result = await productRepo.getProducts({ page, pageSize, search, sort, direction });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/data/:id
 * Updates a single field on a record by ID or SKU.
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value } = req.body;
    const result = await productRepo.updateProductField(id, field, value);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
