<?php
/**
 * Grade Calculator API — PHP Backend
 *
 * Replaces the Java GradeCalculatorServer + GradeCalculator classes.
 *
 * Accepts POST with JSON body:
 *   { mode: "both"|"lecture"|"laboratory", lecture: [...], laboratory: [...] }
 *
 * Each entry: { name, score, totalScore, percentage }
 *
 * Formulas:
 *   Exam grade:    (score / totalScore) * 85 + 15) * (percentage / 100)
 *   Section grade: sum of all exam grades
 *   Final grade:   lectureGrade * 0.30 + labGrade * 0.70
 */

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use POST.']);
    exit;
}

// ===== Helper Functions =====

/**
 * Compute a single exam's contribution to the section grade.
 *
 * @param float $score      Student's raw score
 * @param float $totalScore Maximum possible score
 * @param float $percentage Weight of this exam within its section (0–100)
 * @return float The weighted exam grade
 */
function computeExamGrade(float $score, float $totalScore, float $percentage): float {
    if ($totalScore <= 0) {
        throw new InvalidArgumentException("Total score must be greater than 0.");
    }
    $transmutedGrade = ($score / $totalScore) * 85.0 + 15.0;
    return $transmutedGrade * ($percentage / 100.0);
}

/**
 * Compute the total grade for a section (lecture or laboratory).
 *
 * @param array $entries Array of exam entry objects
 * @return float The sum of each exam's weighted grade
 */
function computeSectionGrade(array $entries): float {
    $sectionGrade = 0.0;
    foreach ($entries as $entry) {
        $score      = floatval($entry['score'] ?? 0);
        $totalScore = floatval($entry['totalScore'] ?? 0);
        $percentage = floatval($entry['percentage'] ?? 0);

        // Validate
        if ($totalScore <= 0) {
            throw new InvalidArgumentException("Total score must be greater than 0 for \"{$entry['name']}\".");
        }
        if ($score < 0) {
            throw new InvalidArgumentException("Score cannot be negative for \"{$entry['name']}\".");
        }
        if ($score > $totalScore) {
            throw new InvalidArgumentException("Score cannot exceed total score for \"{$entry['name']}\".");
        }
        if ($percentage < 0 || $percentage > 100) {
            throw new InvalidArgumentException("Percentage must be between 0 and 100 for \"{$entry['name']}\".");
        }

        $sectionGrade += computeExamGrade($score, $totalScore, $percentage);
    }
    return $sectionGrade;
}

/**
 * Compute the final grade from lecture and laboratory section grades.
 *
 * @param float $lectureGrade    Total lecture section grade
 * @param float $laboratoryGrade Total laboratory section grade
 * @return float The overall final grade
 */
function computeFinalGrade(float $lectureGrade, float $laboratoryGrade): float {
    return $lectureGrade * 0.30 + $laboratoryGrade * 0.70;
}

// ===== Main Logic =====

try {
    // Read and parse JSON body
    $rawBody = file_get_contents('php://input');
    $data = json_decode($rawBody, true);

    if ($data === null) {
        throw new InvalidArgumentException("Invalid JSON body.");
    }

    $mode = $data['mode'] ?? 'both';

    if (!in_array($mode, ['both', 'lecture', 'laboratory'])) {
        throw new InvalidArgumentException("Invalid mode. Use 'both', 'lecture', or 'laboratory'.");
    }

    $lectureGrade = 0.0;
    $labGrade     = 0.0;
    $finalGrade   = 0.0;

    // Calculate based on mode
    if ($mode === 'both' || $mode === 'lecture') {
        $lectureEntries = $data['lecture'] ?? [];
        if (empty($lectureEntries)) {
            throw new InvalidArgumentException("Lecture entries are required for mode '{$mode}'.");
        }
        $lectureGrade = computeSectionGrade($lectureEntries);
    }

    if ($mode === 'both' || $mode === 'laboratory') {
        $labEntries = $data['laboratory'] ?? [];
        if (empty($labEntries)) {
            throw new InvalidArgumentException("Laboratory entries are required for mode '{$mode}'.");
        }
        $labGrade = computeSectionGrade($labEntries);
    }

    if ($mode === 'both') {
        $finalGrade = computeFinalGrade($lectureGrade, $labGrade);
    }

    // Send response
    echo json_encode([
        'lectureGrade' => round($lectureGrade, 4),
        'labGrade'     => round($labGrade, 4),
        'finalGrade'   => round($finalGrade, 4),
    ]);

} catch (InvalidArgumentException $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error: ' . $e->getMessage()]);
}
