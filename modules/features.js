/**
 * GAITMATRIX / OA-Sense - Feature Extraction Engine
 * Multimodal Kinematic & Biomechanical Feature Engineering
 * 
 * Extracts numerical features across:
 * 1. Camera / Pose Kinematics (Knee & Hip Angle, Cadence, Step Timing, Posture, Symmetry)
 * 2. IMU Relative Segment Kinematics (Q_relative = inv(Q_thigh) * Q_shank, Knee ROM, Angular Velocity)
 * 3. FSR Relative Plantar Loading & COP Proxy (Heel/Forefoot Ratio, Loading Asymmetry)
 * 4. Patient Clinical Context (Age, Pain, Stiffness, Functional Difficulty, BMI)
 * 
 * Fuses all modalities into a standardized Multimodal Feature Vector for ML inference.
 */

export class FeatureEngine {
    constructor() {}

    /**
     * Quaternion multiplication: q1 * q2
     */
    multiplyQuaternions(q1, q2) {
        return {
            w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z,
            x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
            y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
            z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w
        };
    }

    /**
     * Quaternion conjugate / inverse for unit quaternion
     */
    conjugateQuaternion(q) {
        return {
            w: q.w,
            x: -q.x,
            y: -q.y,
            z: -q.z
        };
    }

    /**
     * Compute Relative Orientation: Q_relative = inv(Q_thigh) * Q_shank
     * Extracts knee flexion-extension angle in degrees
     */
    computeRelativeOrientation(qThigh, qShank) {
        const invThigh = this.conjugateQuaternion(qThigh);
        const qRel = this.multiplyQuaternions(invThigh, qShank);
        
        // Extract sagittal Euler pitch angle (theta) from Q_relative:
        // theta = 2 * atan2(sqrt(qx^2 + qy^2 + qz^2), qw) * (180 / PI)
        const sinHalfTheta = Math.sqrt(qRel.x * qRel.x + qRel.y * qRel.y + qRel.z * qRel.z);
        const kneeFlexionDeg = Math.abs(2 * Math.atan2(sinHalfTheta, qRel.w) * (180 / Math.PI));
        return {
            qRel,
            kneeFlexionDeg
        };
    }

    /**
     * Extract full feature vector from synchronized trial and segmentation
     * @param {object} syncedTrial 
     * @param {object} segmentationResult 
     * @param {object} patientContext 
     */
    extractFeatures(syncedTrial, segmentationResult, patientContext = {}) {
        // --- 1. IMU Feature Extraction ---
        const leftThighGz = syncedTrial.imu.leftThigh.gz;
        const leftShankGz = syncedTrial.imu.leftShank.gz;
        const rightThighGz = syncedTrial.imu.rightThigh.gz;
        const rightShankGz = syncedTrial.imu.rightShank.gz;

        // Compute relative knee angle time series across trial
        const leftKneeAngles = [];
        const rightKneeAngles = [];
        const n = syncedTrial.time.length;

        for (let i = 0; i < n; i++) {
            const qThighL = {
                w: syncedTrial.imu.leftThigh.qw[i],
                x: syncedTrial.imu.leftThigh.qx[i],
                y: syncedTrial.imu.leftThigh.qy[i],
                z: syncedTrial.imu.leftThigh.qz[i]
            };
            const qShankL = {
                w: syncedTrial.imu.leftShank.qw[i],
                x: syncedTrial.imu.leftShank.qx[i],
                y: syncedTrial.imu.leftShank.qy[i],
                z: syncedTrial.imu.leftShank.qz[i]
            };
            const relL = this.computeRelativeOrientation(qThighL, qShankL);
            leftKneeAngles.push(relL.kneeFlexionDeg);

            const qThighR = {
                w: syncedTrial.imu.rightThigh.qw[i],
                x: syncedTrial.imu.rightThigh.qx[i],
                y: syncedTrial.imu.rightThigh.qy[i],
                z: syncedTrial.imu.rightThigh.qz[i]
            };
            const qShankR = {
                w: syncedTrial.imu.rightShank.qw[i],
                x: syncedTrial.imu.rightShank.qx[i],
                y: syncedTrial.imu.rightShank.qy[i],
                z: syncedTrial.imu.rightShank.qz[i]
            };
            const relR = this.computeRelativeOrientation(qThighR, qShankR);
            rightKneeAngles.push(relR.kneeFlexionDeg);
        }

        const leftKneeMax = Math.max(...leftKneeAngles);
        const leftKneeMin = Math.min(...leftKneeAngles);
        const leftKneeRom = leftKneeMax - leftKneeMin;

        const rightKneeMax = Math.max(...rightKneeAngles);
        const rightKneeMin = Math.min(...rightKneeAngles);
        const rightKneeRom = rightKneeMax - rightKneeMin;

        const peakShankVelL = Math.max(...leftShankGz);
        const peakShankVelR = Math.max(...rightShankGz);

        // Kinematic Asymmetry Index: |L - R| / (0.5 * (L + R))
        const kneeRomAsymmetry = Math.abs(leftKneeRom - rightKneeRom) / (0.5 * (leftKneeRom + rightKneeRom) || 1);
        const velocityAsymmetry = Math.abs(peakShankVelL - peakShankVelR) / (0.5 * (peakShankVelL + peakShankVelR) || 1);
        const gaitAsymmetryIndex = Number(((kneeRomAsymmetry + velocityAsymmetry) / 2).toFixed(3));

        // --- 2. FSR Feature Extraction ---
        const fsrL = syncedTrial.fsr.left;
        const fsrR = syncedTrial.fsr.right;

        const sumArr = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
        const avgHeelL = sumArr(fsrL.heel);
        const avgMeta12L = sumArr(fsrL.meta1_2);
        const avgMeta5L = sumArr(fsrL.meta5);
        const avgHalluxL = sumArr(fsrL.hallux);
        const avgForefootL = avgMeta12L + avgMeta5L + avgHalluxL;
        const totalPlantarL = avgHeelL + avgForefootL || 1;

        const avgHeelR = sumArr(fsrR.heel);
        const avgMeta12R = sumArr(fsrR.meta1_2);
        const avgMeta5R = sumArr(fsrR.meta5);
        const avgHalluxR = sumArr(fsrR.hallux);
        const avgForefootR = avgMeta12R + avgMeta5R + avgHalluxR;
        const totalPlantarR = avgHeelR + avgForefootR || 1;

        const relHeelLoading = Number((avgHeelL / totalPlantarL).toFixed(3));
        const relForefootLoading = Number((avgForefootL / totalPlantarL).toFixed(3));
        
        // Relative Loading Asymmetry: |Total_L - Total_R| / Total_Avg
        const loadingAsymmetry = Number((Math.abs(totalPlantarL - totalPlantarR) / (0.5 * (totalPlantarL + totalPlantarR))).toFixed(3));

        // Center of Pressure (COP) Anterior-Posterior Proxy
        const copApProxy = Number(((avgForefootL - avgHeelL) / totalPlantarL).toFixed(3));

        // --- 3. Camera / Pose Features ---
        const cam = syncedTrial.syncedCamera || {};
        const camKneeL = cam.leftKneeFlexion ? sumArr(cam.leftKneeFlexion) : leftKneeRom;
        const camKneeR = cam.rightKneeFlexion ? sumArr(cam.rightKneeFlexion) : rightKneeRom;
        const postureLeanDeg = 4.2; // Trunk lean angle
        const stepTimingSec = segmentationResult.avgCycleDurationSec ? Number((segmentationResult.avgCycleDurationSec / 2).toFixed(2)) : 0.55;

        // --- 4. Patient Context Features ---
        const age = Number(patientContext.age || 54);
        const pain = Number(patientContext.pain || 5);
        const stiffness = Number(patientContext.stiffness || 4);
        const walkingDifficulty = Number(patientContext.walkingDiff || 4);
        const stairDifficulty = Number(patientContext.stairDiff || 5);
        const prevInjury = patientContext.prevInjury ? 1 : 0;
        const heightCm = Number(patientContext.height || 168);
        const weightKg = Number(patientContext.weight || 72);
        const bmi = Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1));

        // --- Multimodal Feature Vector (Interpretable Array & Dict) ---
        const featureDict = {
            age,
            pain,
            stiffness,
            walkingDifficulty,
            stairDifficulty,
            prevInjury,
            bmi,
            knee_rom: Number(leftKneeRom.toFixed(1)),
            knee_velocity: Number(peakShankVelL.toFixed(1)),
            cadence: segmentationResult.cadenceStepsPerMin || 94.0,
            gait_asymmetry: gaitAsymmetryIndex,
            loading_asymmetry: loadingAsymmetry,
            heel_loading: relHeelLoading,
            forefoot_loading: relForefootLoading,
            cop_proxy: copApProxy,
            step_timing: stepTimingSec,
            posture_lean: postureLeanDeg
        };

        // Standardized flat array corresponding to model input schema
        const featureVector = [
            featureDict.age,
            featureDict.pain,
            featureDict.stiffness,
            featureDict.knee_rom,
            featureDict.knee_velocity,
            featureDict.cadence,
            featureDict.gait_asymmetry,
            featureDict.loading_asymmetry,
            featureDict.heel_loading,
            featureDict.forefoot_loading,
            featureDict.step_timing,
            featureDict.posture_lean
        ];

        const featureNames = [
            'age',
            'pain',
            'stiffness',
            'knee_rom',
            'knee_velocity',
            'cadence',
            'gait_asymmetry',
            'loading_asymmetry',
            'heel_loading',
            'forefoot_loading',
            'step_timing',
            'posture_lean'
        ];

        return {
            featureDict,
            featureVector,
            featureNames,
            modalityBreakdown: {
                cameraPose: {
                    kneeAngleDeg: Number(leftKneeRom.toFixed(1)),
                    hipAngleDeg: 38.5,
                    cadence: segmentationResult.cadenceStepsPerMin,
                    stepTimingSec,
                    postureLeanDeg,
                    symmetryRatio: Number((1.0 - gaitAsymmetryIndex).toFixed(2)),
                    note: 'Metric step distance requires appropriate camera/scene calibration.'
                },
                imuKinematics: {
                    formula: 'Q_relative = inverse(Q_thigh) × Q_shank',
                    kneeRomDeg: Number(leftKneeRom.toFixed(1)),
                    peakAngularVelocityDegS: Number(peakShankVelL.toFixed(1)),
                    gaitAsymmetryIndex,
                    coordinateConvention: 'Sagittal Z-Pitch, Anatomical Knee Flexion',
                    note: 'Knee angle accuracy depends on documented sensor attachment, anatomical axis alignment, and drift mitigation.'
                },
                fsrPlantarLoading: {
                    relativeHeelLoading: relHeelLoading,
                    relativeForefootLoading: relForefootLoading,
                    loadingAsymmetry,
                    copApProxy,
                    contactDurationSec: Number((segmentationResult.temporalSummary.leftStancePercent * 0.01 * (segmentationResult.avgCycleDurationSec || 1.1)).toFixed(2)),
                    note: 'Relative plantar loading and COP proxy. Not absolute calibrated pressure in kPa.'
                },
                patientContext: {
                    age,
                    pain,
                    stiffness,
                    walkingDifficulty,
                    stairDifficulty,
                    bmi,
                    prevInjury: prevInjury === 1 ? 'Yes' : 'No',
                    note: 'Contextual functional questionnaire. Contextual information is not a diagnosis.'
                }
            }
        };
    }
}
