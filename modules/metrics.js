/**
 * GAITMATRIX / OA-Sense - Evaluation & Metrics Module
 * Pure Client-Side Machine Learning Evaluation & Confusion Matrix
 * 
 * Computes:
 * 1. Accuracy
 * 2. Multi-Class Precision, Recall, F1 (Macro and Weighted)
 * 3. One-vs-Rest Sensitivity & Specificity per class
 * 4. 3x3 Multi-Class Confusion Matrix
 * 
 * Strict Scientific Rule:
 * All metrics are calculated dynamically on the holdout participant test set.
 * Metrics are explicitly labeled as DEMO SYNTHETIC VALIDATION.
 */

export class MetricsEvaluator {
    constructor(targetClasses = ['LOW', 'MODERATE', 'ELEVATED']) {
        this.targetClasses = targetClasses;
        this.numClasses = targetClasses.length;
    }

    /**
     * Compute full evaluation suite from true and predicted class indices
     * @param {Array<number>} yTrue - Ground truth class indices [0, 1, 2]
     * @param {Array<number>} yPred - Model predicted class indices [0, 1, 2]
     * @returns {object} Comprehensive evaluation report
     */
    evaluate(yTrue, yPred) {
        const n = yTrue.length;
        if (n === 0) throw new Error('Cannot evaluate empty predictions array.');

        // 1. Construct 3x3 Confusion Matrix: cm[trueClass][predClass]
        const confusionMatrix = Array.from({ length: this.numClasses }, () => 
            new Array(this.numClasses).fill(0)
        );

        let correct = 0;
        for (let i = 0; i < n; i++) {
            const t = yTrue[i];
            const p = yPred[i];
            confusionMatrix[t][p]++;
            if (t === p) correct++;
        }

        const accuracy = Number((correct / n).toFixed(4));

        // 2. Per-class One-vs-Rest True Positives, False Positives, False Negatives, True Negatives
        const perClassMetrics = [];
        const classSupports = new Array(this.numClasses).fill(0);

        for (let c = 0; c < this.numClasses; c++) {
            const tp = confusionMatrix[c][c];
            let fp = 0;
            let fn = 0;
            let tn = 0;

            for (let r = 0; r < this.numClasses; r++) {
                for (let col = 0; col < this.numClasses; col++) {
                    if (r === c && col !== c) fn += confusionMatrix[r][col];
                    if (r !== c && col === c) fp += confusionMatrix[r][col];
                    if (r !== c && col !== c) tn += confusionMatrix[r][col];
                }
            }

            const support = tp + fn;
            classSupports[c] = support;

            const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
            const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0; // Sensitivity
            const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
            const specificity = (tn + fp) > 0 ? tn / (tn + fp) : 0;

            perClassMetrics.push({
                className: this.targetClasses[c],
                support,
                tp,
                fp,
                fn,
                tn,
                precision: Number(precision.toFixed(4)),
                recall: Number(recall.toFixed(4)),
                sensitivity: Number(recall.toFixed(4)),
                specificity: Number(specificity.toFixed(4)),
                f1: Number(f1.toFixed(4))
            });
        }

        // 3. Macro & Weighted Averages
        const macroPrecision = Number((perClassMetrics.reduce((a, m) => a + m.precision, 0) / this.numClasses).toFixed(4));
        const macroRecall = Number((perClassMetrics.reduce((a, m) => a + m.recall, 0) / this.numClasses).toFixed(4));
        const macroF1 = Number((perClassMetrics.reduce((a, m) => a + m.f1, 0) / this.numClasses).toFixed(4));
        const macroSensitivity = macroRecall;
        const macroSpecificity = Number((perClassMetrics.reduce((a, m) => a + m.specificity, 0) / this.numClasses).toFixed(4));

        let weightedPrecision = 0;
        let weightedRecall = 0;
        let weightedF1 = 0;
        for (let c = 0; c < this.numClasses; c++) {
            const weight = classSupports[c] / n;
            weightedPrecision += perClassMetrics[c].precision * weight;
            weightedRecall += perClassMetrics[c].recall * weight;
            weightedF1 += perClassMetrics[c].f1 * weight;
        }

        weightedPrecision = Number(weightedPrecision.toFixed(4));
        weightedRecall = Number(weightedRecall.toFixed(4));
        weightedF1 = Number(weightedF1.toFixed(4));

        return {
            totalTestSamples: n,
            accuracy,
            accuracyPercent: `${(accuracy * 100).toFixed(1)}%`,
            macro: {
                precision: macroPrecision,
                recall: macroRecall,
                sensitivity: macroSensitivity,
                specificity: macroSpecificity,
                f1: macroF1
            },
            weighted: {
                precision: weightedPrecision,
                recall: weightedRecall,
                f1: weightedF1
            },
            perClass: perClassMetrics,
            confusionMatrix,
            disclaimer: 'DEMO SYNTHETIC VALIDATION: Metrics are computed from the synthetic test split. NOT clinical accuracy.'
        };
    }
}
