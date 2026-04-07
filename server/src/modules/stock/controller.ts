import { Request, Response, NextFunction } from 'express';
import { StockService } from './service';

const stockService = new StockService();

export class StockController {
  async getStock(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.user!.branchId;
      const stock = await stockService.getBranchStock(branchId);
      res.status(200).json({ status: 'success', data: { stock } });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, unit, stock, minStock, categoryId } = req.body;
      const branchId = req.user!.branchId;
      const ingredient = await stockService.createIngredient({
        name, unit, stock, minStock, branchId, categoryId
      });
      res.status(201).json({ status: 'success', data: { ingredient } });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const userId = req.user!.id;
      await stockService.deleteIngredient(id, userId);
      res.status(200).json({ status: 'success', message: 'Ingrediente eliminado' });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { stock, reason } = req.body;
      const userId = req.user!.id;
      const ingredient = await stockService.setStock(id, stock, userId, 'ADJUST', reason);
      res.status(200).json({ status: 'success', data: { ingredient } });
    } catch (error) {
      next(error);
    }
  }

  async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await stockService.getCategories();
      res.status(200).json({ status: 'success', data: { categories } });
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.body;
      const category = await stockService.createCategory(name);
      res.status(201).json({ status: 'success', data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async getMovements(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.user!.branchId;
      const { startDate, endDate } = req.query;
      
      const movements = await stockService.getStockMovements(
        branchId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.status(200).json({ status: 'success', data: { movements } });
    } catch (error) {
      next(error);
    }
  }

  async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.user!.branchId;
      const report = await stockService.getStockReport(branchId);
      res.status(200).json({ status: 'success', data: { report } });
    } catch (error) {
      next(error);
    }
  }
}
