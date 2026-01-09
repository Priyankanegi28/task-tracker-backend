const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(protect);

// Create a new task
router.post('/', async (req, res) => {
    try {
        const { title, description, priority, dueDate, status, tags } = req.body;
        
        const task = new Task({
            title,
            description,
            priority,
            dueDate,
            status,
            tags: tags || [],
            user: req.user._id
        });
        
        const savedTask = await task.save();
        res.status(201).json({
            success: true,
            data: savedTask
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get all tasks for the logged-in user
router.get('/', async (req, res) => {
    try {
        const { status, priority, sortBy, search } = req.query;
        let query = { user: req.user._id };
        
        // Filter by status
        if (status) {
            query.status = status;
        }
        
        // Filter by priority
        if (priority) {
            query.priority = priority;
        }
        
        // Search in title or description
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
        let tasks = Task.find(query);
        
        // Sorting
        if (sortBy === 'dueDate') {
            tasks = tasks.sort({ dueDate: 1 });
        } else if (sortBy === '-dueDate') {
            tasks = tasks.sort({ dueDate: -1 });
        } else if (sortBy === 'createdAt') {
            tasks = tasks.sort({ createdAt: -1 });
        } else if (sortBy === 'priority') {
            const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
            tasks = tasks.sort({ priority: 1 });
        }
        
        const result = await tasks.exec();
        res.json({
            success: true,
            count: result.length,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get task statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await Task.aggregate([
            { $match: { user: req.user._id } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    completed: { 
                        $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
                    },
                    pending: { 
                        $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] }
                    },
                    inProgress: { 
                        $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] }
                    },
                    highPriority: { 
                        $sum: { $cond: [{ $eq: ['$priority', 'High'] }, 1, 0] }
                    }
                }
            }
        ]);
        
        const overdue = await Task.countDocuments({
            user: req.user._id,
            dueDate: { $lt: new Date() },
            status: { $ne: 'Completed' }
        });
        
        const result = stats[0] || { total: 0, completed: 0, pending: 0, inProgress: 0, highPriority: 0 };
        result.overdue = overdue;
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update a task
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Check if task belongs to user
        let task = await Task.findOne({ _id: id, user: req.user._id });
        
        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }
        
        task = await Task.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        );
        
        res.json({
            success: true,
            data: task
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Delete a task
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if task belongs to user
        const task = await Task.findOne({ _id: id, user: req.user._id });
        
        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }
        
        await Task.findByIdAndDelete(id);
        
        res.json({
            success: true,
            message: 'Task deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;