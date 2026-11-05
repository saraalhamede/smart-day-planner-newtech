export function requireAuth(users) {
  return async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Authentication required.' });
    try {
      const user = await users.findById(req.session.userId);
      if (!user) {
        return req.session.destroy((error) => {
          if (error) return next(error);
          res.status(401).json({ error: 'Authentication required.' });
        });
      }
      req.user = user;
      next();
    } catch (error) { next(error); }
  };
}
