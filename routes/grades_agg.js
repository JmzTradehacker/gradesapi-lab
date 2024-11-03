import express from "express";
import db from "../db/conn.js";

const router = express.Router();

router.get('/stats/:id', async (req, res) => {
  const classId = parseInt(req.params.id, 10); // Parse the class_id from the request parameters

  try {
    const result = await db.collection('grades')
      .aggregate([
        { $match: { class_id: classId } }, // Filter by class_id
        { $unwind: '$scores' },
        {
          $group: {
            _id: '$learner_id',
            exam: { $avg: { $cond: [{ $eq: ['$scores.type', 'exam'] }, '$scores.score', null] } },
            quiz: { $avg: { $cond: [{ $eq: ['$scores.type', 'quiz'] }, '$scores.score', null] } },
            homework: { $avg: { $cond: [{ $eq: ['$scores.type', 'homework'] }, '$scores.score', null] } },
          },
        },
        {
          $project: {
            avg: {
              $sum: [
                { $multiply: ['$exam', 0.5] },
                { $multiply: ['$quiz', 0.3] },
                { $multiply: ['$homework', 0.2] }
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalLearners: { $sum: 1 },
            above70: { $sum: { $cond: [{ $gt: ['$avg', 70] }, 1, 0] } },
          },
        },
        {
          $project: {
            totalLearners: 1,
            above70: 1,
            percentageAbove70: { $multiply: [{ $divide: ['$above70', '$totalLearners'] }, 100] },
          },
        },
      ])
      .toArray();

    res.status(200).json(result);
  } catch (error) {
    console.error('Error in /grades/stats/:id route:', error);
    res.status(500).json({ error: `Error fetching stats for class ${classId}: ${error.message}` });
  }
});

/**
 * It is not best practice to seperate these routes
 * like we have done here. This file was created
 * specifically for educational purposes, to contain
 * all aggregation routes in one place.
 */

/**
 * Grading Weights by Score Type:
 * - Exams: 50%
 * - Quizes: 30%
 * - Homework: 20%
 */

// Get the weighted average of a specified learner's grades, per class
router.get("/learner/:id/avg-class", async (req, res) => {
  let collection = await db.collection("grades");

  let result = await collection
    .aggregate([
      {
        $match: { learner_id: Number(req.params.id) },
      },
      {
        $unwind: { path: "$scores" },
      },
      {
        $group: {
          _id: "$class_id",
          quiz: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "quiz"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          exam: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "exam"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          homework: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "homework"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          class_id: "$_id",
          avg: {
            $sum: [
              { $multiply: [{ $avg: "$exam" }, 0.5] },
              { $multiply: [{ $avg: "$quiz" }, 0.3] },
              { $multiply: [{ $avg: "$homework" }, 0.2] },
            ],
          },
        },
      },
    ])
    .toArray();

  if (!result) res.send("Not found").status(404);
  else res.send(result).status(200);
});

export default router;
