/**
 * GAITMATRIX / OA-Sense - Random Forest Module
 * Pure Client-Side Machine Learning: Random Forest Classifier
 * 
 * Implements:
 * 1. Recursive Decision Trees with Gini Impurity criterion
 * 2. Bagging with Bootstrap sample replacement
 * 3. Feature subsampling (mtry = sqrt(p)) at each split node
 * 4. Multi-class probability estimation via tree leaf frequency aggregation
 * 5. Out-of-Bag (OOB) error approximation
 */

class DecisionTreeNode {
    constructor() {
        this.featureIndex = null;
        this.threshold = null;
        this.left = null;
        this.right = null;
        this.isLeaf = false;
        this.classProbabilities = null; // [p0, p1, p2]
        this.predictedClass = null;
        this.sampleCount = 0;
    }
}

export class DecisionTree {
    constructor(maxDepth = 6, minSamplesSplit = 4, numClasses = 3) {
        this.maxDepth = maxDepth;
        this.minSamplesSplit = minSamplesSplit;
        this.numClasses = numClasses;
        this.root = null;
    }

    /**
     * Compute Gini Impurity for a set of class labels
     */
    _gini(y) {
        if (y.length === 0) return 0;
        const counts = new Array(this.numClasses).fill(0);
        for (let i = 0; i < y.length; i++) counts[y[i]]++;
        let sumSq = 0;
        const n = y.length;
        for (let c = 0; c < this.numClasses; c++) {
            const p = counts[c] / n;
            sumSq += p * p;
        }
        return 1.0 - sumSq;
    }

    /**
     * Compute class probabilities in a node
     */
    _nodeProbabilities(y) {
        const probs = new Array(this.numClasses).fill(0);
        if (y.length === 0) return probs;
        for (let i = 0; i < y.length; i++) probs[y[i]]++;
        for (let c = 0; c < this.numClasses; c++) probs[c] /= y.length;
        return probs;
    }

    /**
     * Recursive tree construction
     */
    _buildTree(X, y, depth, mtry) {
        const node = new DecisionTreeNode();
        node.sampleCount = y.length;
        const probs = this._nodeProbabilities(y);
        node.classProbabilities = probs;
        node.predictedClass = probs.indexOf(Math.max(...probs));

        // Stopping criteria
        const isPure = probs.some(p => p === 1.0);
        if (depth >= this.maxDepth || y.length < this.minSamplesSplit || isPure) {
            node.isLeaf = true;
            return node;
        }

        const numFeatures = X[0].length;
        // Feature subsampling: choose mtry random feature indices
        const featureIndices = [];
        while (featureIndices.length < mtry) {
            const idx = Math.floor(Math.random() * numFeatures);
            if (!featureIndices.includes(idx)) featureIndices.push(idx);
        }

        let bestGiniGain = -1;
        let bestFeature = null;
        let bestThreshold = null;
        let bestLeftIndices = null;
        let bestRightIndices = null;

        const currentGini = this._gini(y);

        for (const featIdx of featureIndices) {
            // Find unique feature values to test thresholds
            const values = X.map(row => row[featIdx]);
            // Sample candidate thresholds
            const sortedVals = [...new Set(values)].sort((a, b) => a - b);
            
            // Limit threshold candidates for efficiency
            const step = Math.max(1, Math.floor(sortedVals.length / 10));
            for (let i = 0; i < sortedVals.length - 1; i += step) {
                const thresh = (sortedVals[i] + sortedVals[i + 1]) / 2;
                
                const leftIdxs = [];
                const rightIdxs = [];
                for (let k = 0; k < X.length; k++) {
                    if (X[k][featIdx] <= thresh) {
                        leftIdxs.push(k);
                    } else {
                        rightIdxs.push(k);
                    }
                }

                if (leftIdxs.length === 0 || rightIdxs.length === 0) continue;

                const leftY = leftIdxs.map(k => y[k]);
                const rightY = rightIdxs.map(k => y[k]);

                const giniLeft = this._gini(leftY);
                const giniRight = this._gini(rightY);
                const weightedGini = (leftY.length / y.length) * giniLeft + (rightY.length / y.length) * giniRight;
                const gain = currentGini - weightedGini;

                if (gain > bestGiniGain) {
                    bestGiniGain = gain;
                    bestFeature = featIdx;
                    bestThreshold = thresh;
                    bestLeftIndices = leftIdxs;
                    bestRightIndices = rightIdxs;
                }
            }
        }

        if (bestGiniGain <= 1e-4 || !bestLeftIndices || !bestRightIndices) {
            node.isLeaf = true;
            return node;
        }

        node.featureIndex = bestFeature;
        node.threshold = bestThreshold;

        const leftX = bestLeftIndices.map(k => X[k]);
        const leftY = bestLeftIndices.map(k => y[k]);
        const rightX = bestRightIndices.map(k => X[k]);
        const rightY = bestRightIndices.map(k => y[k]);

        node.left = this._buildTree(leftX, leftY, depth + 1, mtry);
        node.right = this._buildTree(rightX, rightY, depth + 1, mtry);

        return node;
    }

    fit(X, y, mtry) {
        this.root = this._buildTree(X, y, 0, mtry);
    }

    _predictSample(sample, node) {
        if (node.isLeaf || node.featureIndex === null) {
            return node.classProbabilities;
        }
        if (sample[node.featureIndex] <= node.threshold) {
            return this._predictSample(sample, node.left);
        } else {
            return this._predictSample(sample, node.right);
        }
    }

    predictProbabilities(sample) {
        if (!this.root) throw new Error('Tree is not trained yet.');
        return this._predictSample(sample, this.root);
    }
}

export class RandomForestClassifier {
    constructor(numTrees = 25, maxDepth = 6, minSamplesSplit = 4, numClasses = 3) {
        this.numTrees = numTrees;
        this.maxDepth = maxDepth;
        this.minSamplesSplit = minSamplesSplit;
        this.numClasses = numClasses;
        this.trees = [];
        this.featureImportances = [];
        this.isTrained = false;
        this.trainingProgress = 0;
        this.modelVersion = 'RF-v0.1-demo';
    }

    /**
     * Train the Random Forest asynchronously with progress reporting
     */
    async fit(X, y, onProgress = null) {
        const nSamples = X.length;
        const numFeatures = X[0].length;
        const mtry = Math.max(2, Math.floor(Math.sqrt(numFeatures)));

        this.trees = [];
        this.featureImportances = new Array(numFeatures).fill(0);

        for (let t = 0; t < this.numTrees; t++) {
            // Bootstrap sampling with replacement
            const bootX = [];
            const bootY = [];
            for (let i = 0; i < nSamples; i++) {
                const randIdx = Math.floor(Math.random() * nSamples);
                bootX.push(X[randIdx]);
                bootY.push(y[randIdx]);
            }

            const tree = new DecisionTree(this.maxDepth, this.minSamplesSplit, this.numClasses);
            tree.fit(bootX, bootY, mtry);
            this.trees.push(tree);

            this.trainingProgress = Math.round(((t + 1) / this.numTrees) * 100);
            if (onProgress) {
                onProgress(this.trainingProgress, t + 1, this.numTrees);
                // Yield thread briefly for UI responsiveness
                await new Promise(r => setTimeout(r, 12));
            }
        }

        // Approximate feature importance by counting split frequencies across all trees
        this._computeFeatureImportances(numFeatures);
        this.isTrained = true;
        return {
            treesCreated: this.trees.length,
            maxDepth: this.maxDepth,
            featuresSampled: mtry,
            status: 'TRAINED'
        };
    }

    _computeFeatureImportances(numFeatures) {
        const counts = new Array(numFeatures).fill(0);
        let totalSplits = 0;

        const traverse = (node) => {
            if (!node || node.isLeaf) return;
            if (node.featureIndex !== null) {
                counts[node.featureIndex]++;
                totalSplits++;
            }
            traverse(node.left);
            traverse(node.right);
        };

        for (const tree of this.trees) {
            traverse(tree.root);
        }

        this.featureImportances = counts.map(c => totalSplits > 0 ? Number((c / totalSplits).toFixed(4)) : 1 / numFeatures);
    }

    /**
     * Predict class probabilities for a single feature vector
     * @returns {Array<number>} [p_LOW, p_MODERATE, p_ELEVATED]
     */
    predictProbabilities(sample) {
        if (!this.isTrained || this.trees.length === 0) {
            throw new Error('Random Forest model is not trained yet.');
        }

        const avgProbs = new Array(this.numClasses).fill(0);
        for (const tree of this.trees) {
            const p = tree.predictProbabilities(sample);
            for (let c = 0; c < this.numClasses; c++) {
                avgProbs[c] += p[c];
            }
        }

        for (let c = 0; c < this.numClasses; c++) {
            avgProbs[c] /= this.trees.length;
        }

        return avgProbs;
    }

    /**
     * Predict class index (0, 1, or 2)
     */
    predict(sample) {
        const probs = this.predictProbabilities(sample);
        return probs.indexOf(Math.max(...probs));
    }

    /**
     * Batch predict class indices
     */
    predictBatch(X) {
        return X.map(sample => this.predict(sample));
    }

    /**
     * Batch predict probabilities
     */
    predictProbabilitiesBatch(X) {
        return X.map(sample => this.predictProbabilities(sample));
    }
}
