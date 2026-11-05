import { Router } from 'express';
import { TaskError, validateFilters, validateId } from './validation.js';

export function taskRoutes(authenticate, tasks) {
  const router = Router();
  router.use(authenticate);
  router.get('/', async (req, res) => res.json({ tasks: await tasks.list(req.user.id, validateFilters(req.query)) }));
  router.get('/:id', async (req, res) => res.json({ task: await tasks.get(req.user.id, validateId(req.params.id)) }));
  router.post('/', async (req, res) => {
    const task = await tasks.create(req.user.id, req.body);
    res.status(201).location(`/api/tasks/${task.id}`).json({ task });
  });
  router.patch('/:id', async (req, res) => res.json({ task: await tasks.update(req.user.id, validateId(req.params.id), req.body) }));
  router.delete('/:id', async (req, res) => {
    await tasks.remove(req.user.id, validateId(req.params.id));
    res.status(204).end();
  });
  router.use((error, req, res, next) => {
    if (error instanceof TaskError) return res.status(error.status).json({ error: error.message });
    next(error);
  });
  return router;
}
