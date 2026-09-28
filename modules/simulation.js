/**
 * GAITMATRIX / OA-Sense - Simulation Module
 * Deterministic Synthetic Multimodal Gait Signal Generator
 * 
 * Generates biomechanically plausible synthetic signals for:
 * - 1 Camera: 2D side-view sagittal plane gait landmarks (Hip, Knee, Ankle, Foot)
 * - 4 IMUs: Left Thigh, Left Shank, Right Thigh, Right Shank (Acc X/Y/Z, Gyro X/Y/Z @ 100 Hz)
 * - 8 FSRs: Left & Right (Hallux, 1st/2nd Metatarsal, 5th Metatarsal, Heel)
 * 
 * Hardware Adapter Interface allows seamless swapping with real hardware drivers
 * (e.g. Serial/WebUSB/WebSocket) without refactoring the ML pipeline.
 */

// Seeded pseudo-random number generator for reproducible deterministic signals
class SeededRandom {
    constructor(seed = 42) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }

    range(min, max) {
        return min + this.next() * (max - min);
    }

    gaussian(mean = 0, stdev = 1) {
        let u = 1 - this.next();
        let v = this.next();
        let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return mean + z * stdev;
    }
}

export class SimulationEngine {
    constructor(seed = 101) {
        this.rng = new SeededRandom(seed);
        this.sampleRate = 100; // 100 Hz for IMU/FSR
        this.cameraFps = 30;   // 30 fps for Camera Pose
        this.isRunning = false;
        this.currentGaitPattern = 'normal'; // 'normal', 'mild_asymmetric', 'restricted_flexion'
        this.gaitSpeed = 1.0; // Gait frequency multiplier (1.0 = ~1.1s cycle)
    }

    setGaitPattern(pattern, speed = 1.0) {
        this.currentGaitPattern = pattern;
        this.gaitSpeed = speed;
    }

    /**
     * Generate complete synchronized multi-sensor trial data for a specified duration
     * @param {number} durationSeconds - Duration in seconds (e.g. 5.0)
     * @param {string} pattern - 'normal' | 'mild_asymmetric' | 'restricted_flexion'
     * @param {object} patientContext - Age, Pain, BMI, etc.
     * @returns {object} Synchronized raw sensor streams and ground truth metadata
     */
    generateTrialData(durationSeconds = 6.0, pattern = 'normal', patientContext = {}) {
        this.setGaitPattern(pattern);
        const totalSamples = Math.floor(durationSeconds * this.sampleRate);
        const dt = 1.0 / this.sampleRate;
        const cycleDuration = 1.1 / this.gaitSpeed; // ~1.1 seconds per gait cycle

        const time = [];
        const cameraFrames = [];
        const imu = {
            leftThigh: { ax: [], ay: [], az: [], gx: [], gy: [], gz: [], qw: [], qx: [], qy: [], qz: [] },
            leftShank: { ax: [], ay: [], az: [], gx: [], gy: [], gz: [], qw: [], qx: [], qy: [], qz: [] },
            rightThigh: { ax: [], ay: [], az: [], gx: [], gy: [], gz: [], qw: [], qx: [], qy: [], qz: [] },
            rightShank: { ax: [], ay: [], az: [], gx: [], gy: [], gz: [], qw: [], qx: [], qy: [], qz: [] }
        };
        const fsr = {
            left: { hallux: [], meta1_2: [], meta5: [], heel: [], totalLoading: [] },
            right: { hallux: [], meta1_2: [], meta5: [], heel: [], totalLoading: [] }
        };

        // Biomechanical gait parameters influenced by pattern & patient context
        let romScaleL = 1.0;
        let romScaleR = 1.0;
        let painImpact = (patientContext.pain || 0) / 10.0;
        let asymOffset = 0.0;

        if (pattern === 'restricted_flexion') {
            romScaleL = 0.65 - painImpact * 0.15; // Restricted ROM on Left
            romScaleR = 0.88;
            asymOffset = 0.22;
        } else if (pattern === 'mild_asymmetric') {
            romScaleL = 0.82 - painImpact * 0.1;
            romScaleR = 0.95;
            asymOffset = 0.12;
        } else {
            romScaleL = 1.0 - painImpact * 0.05;
            romScaleR = 1.0;
            asymOffset = 0.02;
        }

        for (let i = 0; i < totalSamples; i++) {
            const t = i * dt;
            time.push(t);
            const phaseL = (t % cycleDuration) / cycleDuration; // 0.0 to 1.0
            const phaseR = ((t + cycleDuration * 0.5) % cycleDuration) / cycleDuration; // Antiphase 50%

            // 1. Generate IMU Gyroscope (Sagittal Angular Velocity around Z-axis in deg/s)
            // Left Leg
            const leftThighGyroZ = this._calcThighGyro(phaseL, romScaleL) + this.rng.gaussian(0, 2.5);
            const leftShankGyroZ = this._calcShankGyro(phaseL, romScaleL) + this.rng.gaussian(0, 3.5);
            // Right Leg
            const rightThighGyroZ = this._calcThighGyro(phaseR, romScaleR) + this.rng.gaussian(0, 2.5);
            const rightShankGyroZ = this._calcShankGyro(phaseR, romScaleR) + this.rng.gaussian(0, 3.5);

            // Transverse and frontal gyro components (small out-of-plane rotations + noise)
            const leftThighGyroX = 8.0 * Math.sin(2 * Math.PI * phaseL) + this.rng.gaussian(0, 1.5);
            const leftThighGyroY = 5.0 * Math.cos(2 * Math.PI * phaseL) + this.rng.gaussian(0, 1.5);
            const leftShankGyroX = 12.0 * Math.sin(2 * Math.PI * phaseL) + this.rng.gaussian(0, 2.0);
            const leftShankGyroY = 6.0 * Math.cos(2 * Math.PI * phaseL) + this.rng.gaussian(0, 2.0);

            const rightThighGyroX = 8.0 * Math.sin(2 * Math.PI * phaseR) + this.rng.gaussian(0, 1.5);
            const rightThighGyroY = 5.0 * Math.cos(2 * Math.PI * phaseR) + this.rng.gaussian(0, 1.5);
            const rightShankGyroX = 12.0 * Math.sin(2 * Math.PI * phaseR) + this.rng.gaussian(0, 2.0);
            const rightShankGyroY = 6.0 * Math.cos(2 * Math.PI * phaseR) + this.rng.gaussian(0, 2.0);

            // 2. Generate IMU Accelerometer (g, with gravity + acceleration spikes at heel strike)
            const leftThighAcc = this._calcThighAcc(phaseL, romScaleL);
            const leftShankAcc = this._calcShankAcc(phaseL, romScaleL);
            const rightThighAcc = this._calcThighAcc(phaseR, romScaleR);
            const rightShankAcc = this._calcShankAcc(phaseR, romScaleR);

            // 3. Orientation Quaternions (Simulated Orientation Tracking)
            const qThighL = this._calcOrientationQuaternion(phaseL, 'thigh', romScaleL);
            const qShankL = this._calcOrientationQuaternion(phaseL, 'shank', romScaleL);
            const qThighR = this._calcOrientationQuaternion(phaseR, 'thigh', romScaleR);
            const qShankR = this._calcOrientationQuaternion(phaseR, 'shank', romScaleR);

            // Store IMU left thigh
            imu.leftThigh.ax.push(leftThighAcc.ax + this.rng.gaussian(0, 0.04));
            imu.leftThigh.ay.push(leftThighAcc.ay + this.rng.gaussian(0, 0.04));
            imu.leftThigh.az.push(leftThighAcc.az + this.rng.gaussian(0, 0.04));
            imu.leftThigh.gx.push(leftThighGyroX);
            imu.leftThigh.gy.push(leftThighGyroY);
            imu.leftThigh.gz.push(leftThighGyroZ);
            imu.leftThigh.qw.push(qThighL.w);
            imu.leftThigh.qx.push(qThighL.x);
            imu.leftThigh.qy.push(qThighL.y);
            imu.leftThigh.qz.push(qThighL.z);

            // Store IMU left shank
            imu.leftShank.ax.push(leftShankAcc.ax + this.rng.gaussian(0, 0.05));
            imu.leftShank.ay.push(leftShankAcc.ay + this.rng.gaussian(0, 0.05));
            imu.leftShank.az.push(leftShankAcc.az + this.rng.gaussian(0, 0.05));
            imu.leftShank.gx.push(leftShankGyroX);
            imu.leftShank.gy.push(leftShankGyroY);
            imu.leftShank.gz.push(leftShankGyroZ);
            imu.leftShank.qw.push(qShankL.w);
            imu.leftShank.qx.push(qShankL.x);
            imu.leftShank.qy.push(qShankL.y);
            imu.leftShank.qz.push(qShankL.z);

            // Store IMU right thigh
            imu.rightThigh.ax.push(rightThighAcc.ax + this.rng.gaussian(0, 0.04));
            imu.rightThigh.ay.push(rightThighAcc.ay + this.rng.gaussian(0, 0.04));
            imu.rightThigh.az.push(rightThighAcc.az + this.rng.gaussian(0, 0.04));
            imu.rightThigh.gx.push(rightThighGyroX);
            imu.rightThigh.gy.push(rightThighGyroY);
            imu.rightThigh.gz.push(rightThighGyroZ);
            imu.rightThigh.qw.push(qThighR.w);
            imu.rightThigh.qx.push(qThighR.x);
            imu.rightThigh.qy.push(qThighR.y);
            imu.rightThigh.qz.push(qThighR.z);

            // Store IMU right shank
            imu.rightShank.ax.push(rightShankAcc.ax + this.rng.gaussian(0, 0.05));
            imu.rightShank.ay.push(rightShankAcc.ay + this.rng.gaussian(0, 0.05));
            imu.rightShank.az.push(rightShankAcc.az + this.rng.gaussian(0, 0.05));
            imu.rightShank.gx.push(rightShankGyroX);
            imu.rightShank.gy.push(rightShankGyroY);
            imu.rightShank.gz.push(rightShankGyroZ);
            imu.rightShank.qw.push(qShankR.w);
            imu.rightShank.qx.push(qShankR.x);
            imu.rightShank.qy.push(qShankR.y);
            imu.rightShank.qz.push(qShankR.z);

            // 4. Generate FSR Relative Plantar Loading (Normalized 0.0 to 1.0)
            const fsrL = this._calcFsrLoading(phaseL, romScaleL);
            const fsrR = this._calcFsrLoading(phaseR, romScaleR);

            fsr.left.heel.push(Math.max(0, fsrL.heel + this.rng.gaussian(0, 0.015)));
            fsr.left.meta5.push(Math.max(0, fsrL.meta5 + this.rng.gaussian(0, 0.015)));
            fsr.left.meta1_2.push(Math.max(0, fsrL.meta1_2 + this.rng.gaussian(0, 0.015)));
            fsr.left.hallux.push(Math.max(0, fsrL.hallux + this.rng.gaussian(0, 0.015)));
            fsr.left.totalLoading.push(fsrL.total);

            fsr.right.heel.push(Math.max(0, fsrR.heel + this.rng.gaussian(0, 0.015)));
            fsr.right.meta5.push(Math.max(0, fsrR.meta5 + this.rng.gaussian(0, 0.015)));
            fsr.right.meta1_2.push(Math.max(0, fsrR.meta1_2 + this.rng.gaussian(0, 0.015)));
            fsr.right.hallux.push(Math.max(0, fsrR.hallux + this.rng.gaussian(0, 0.015)));
            fsr.right.totalLoading.push(fsrR.total);
        }

        // 5. Generate Camera Pose Landmarks (Synchronized @ 30 FPS downsampled/interpolated)
        const cameraSampleInterval = Math.round(this.sampleRate / this.cameraFps);
        for (let i = 0; i < totalSamples; i += cameraSampleInterval) {
            const t = time[i];
            const phaseL = (t % cycleDuration) / cycleDuration;
            const phaseR = ((t + cycleDuration * 0.5) % cycleDuration) / cycleDuration;
            const pose = this._calcCameraPose(phaseL, phaseR, romScaleL, romScaleR);
            cameraFrames.push({
                timestamp: t,
                frameIndex: cameraFrames.length,
                landmarks: pose.landmarks,
                angles: pose.angles,
                confidence: 0.94 + this.rng.range(-0.03, 0.04)
            });
        }

        return {
            metadata: {
                sampleRate: this.sampleRate,
                cameraFps: this.cameraFps,
                durationSeconds,
                totalSamples,
                pattern,
                asymmetryOffset: asymOffset,
                isSynthetic: true,
                disclaimer: 'Deterministic synthetic demonstration data. Not clinical measurement.'
            },
            time,
            imu,
            fsr,
            cameraFrames
        };
    }

    // Kinematic waveform equations based on standard clinical gait profiles (Perry, Winter)
    _calcThighGyro(phase, scale = 1.0) {
        // Thigh angular velocity in sagittal plane (deg/s)
        // Extension during stance (~ -30 to -50 deg/s), rapid flexion in swing (~ +120 deg/s)
        const v = -35 * Math.sin(2 * Math.PI * phase) + 65 * Math.sin(4 * Math.PI * phase - 1.2);
        return v * scale;
    }

    _calcShankGyro(phase, scale = 1.0) {
        // Shank angular velocity in sagittal plane (deg/s)
        // High positive peak during initial swing (~250-350 deg/s), rapid deceleration before heel strike
        let v = 0;
        if (phase < 0.6) {
            // Stance phase (0 - 60% of cycle)
            v = -40 * Math.sin(Math.PI * phase / 0.6) + 15 * Math.sin(2 * Math.PI * phase / 0.6);
        } else {
            // Swing phase (60% - 100% of cycle)
            const swingPhase = (phase - 0.6) / 0.4;
            v = 280 * Math.sin(Math.PI * swingPhase) - 80 * Math.sin(2 * Math.PI * swingPhase);
        }
        return v * scale;
    }

    _calcThighAcc(phase, scale = 1.0) {
        return {
            ax: 0.15 * Math.sin(2 * Math.PI * phase) * scale,
            ay: 0.98 + 0.25 * Math.cos(2 * Math.PI * phase) * scale, // vertical axis around 1g
            az: 0.35 * Math.sin(2 * Math.PI * phase + 0.4) * scale
        };
    }

    _calcShankAcc(phase, scale = 1.0) {
        // Shank experiences distinct impact shock at heel strike (phase ~ 0.02)
        let impact = 0;
        if (phase < 0.08) {
            impact = 1.2 * Math.sin(Math.PI * phase / 0.08);
        }
        return {
            ax: (0.3 * Math.sin(2 * Math.PI * phase) + impact * 0.4) * scale,
            ay: 0.98 + (0.45 * Math.cos(2 * Math.PI * phase) + impact) * scale,
            az: 0.5 * Math.sin(2 * Math.PI * phase + 0.6) * scale
        };
    }

    _calcOrientationQuaternion(phase, segment, scale = 1.0) {
        // Approximate Sagittal Pitch Angle (theta in radians)
        let theta = 0;
        if (segment === 'thigh') {
            // Thigh moves roughly -15 deg (hyperextension) to +25 deg (flexion)
            theta = (20 * Math.sin(2 * Math.PI * phase - 1.0)) * (Math.PI / 180) * scale;
        } else {
            // Shank moves roughly -20 deg to +60 deg
            theta = (35 * Math.sin(2 * Math.PI * phase - 1.8) + 15) * (Math.PI / 180) * scale;
        }
        // Rotation about local Z axis
        const halfTheta = theta / 2;
        return {
            w: Math.cos(halfTheta),
            x: 0,
            y: 0,
            z: Math.sin(halfTheta)
        };
    }

    _calcFsrLoading(phase, scale = 1.0) {
        // Standard normal contact sequence during stance (0% - 62% of gait cycle)
        // 1. Heel Strike: 0% - 15%
        // 2. Midstance / Flat Foot: 15% - 40% (Metatarsal loading)
        // 3. Terminal Stance / Push-off: 40% - 62% (Forefoot & Hallux loading)
        // 4. Swing Phase: 62% - 100% (Zero loading)
        let heel = 0, meta5 = 0, meta1_2 = 0, hallux = 0;

        if (phase < 0.62) {
            const stanceP = phase / 0.62; // 0 to 1 in stance

            // Heel loading curve
            if (stanceP < 0.45) {
                heel = Math.sin(Math.PI * (stanceP / 0.45)) * 0.95;
            }

            // Lateral 5th Metatarsal (loads early midstance)
            if (stanceP > 0.15 && stanceP < 0.75) {
                meta5 = Math.sin(Math.PI * ((stanceP - 0.15) / 0.60)) * 0.70;
            }

            // Medial 1st/2nd Metatarsal (loads late midstance to push-off)
            if (stanceP > 0.30 && stanceP < 0.90) {
                meta1_2 = Math.sin(Math.PI * ((stanceP - 0.30) / 0.60)) * 0.85;
            }

            // Hallux (Great Toe - push-off peak)
            if (stanceP > 0.50) {
                hallux = Math.sin(Math.PI * ((stanceP - 0.50) / 0.50)) * 0.90;
            }
        }

        const total = (heel + meta5 + meta1_2 + hallux) * scale * 0.25;
        return {
            heel: heel * scale,
            meta5: meta5 * scale,
            meta1_2: meta1_2 * scale,
            hallux: hallux * scale,
            total
        };
    }

    _calcCameraPose(phaseL, phaseR, scaleL = 1.0, scaleR = 1.0) {
        // Hip reference position in 2D canvas coordinates (center at x=180, y=140)
        const hipX = 180;
        const hipY = 130;
        const thighLen = 68;
        const shankLen = 72;
        const footLen = 28;

        // Knee and Hip angles based on phase
        // Left Leg
        const hipAngleL = (25 * Math.sin(2 * Math.PI * phaseL - 0.5)) * scaleL; // deg
        const kneeFlexionL = Math.max(0, (55 * Math.sin(2 * Math.PI * phaseL - 2.0) + 15)) * scaleL;
        const ankleAngleL = (15 * Math.sin(2 * Math.PI * phaseL - 1.0));

        // Right Leg
        const hipAngleR = (25 * Math.sin(2 * Math.PI * phaseR - 0.5)) * scaleR;
        const kneeFlexionR = Math.max(0, (55 * Math.sin(2 * Math.PI * phaseR - 2.0) + 15)) * scaleR;
        const ankleAngleR = (15 * Math.sin(2 * Math.PI * phaseR - 1.0));

        // Compute 2D joint positions via forward kinematics
        const rad = Math.PI / 180;

        // Left Leg forward kinematics
        const thighAngleRadL = (90 + hipAngleL) * rad;
        const kneeXL = hipX + thighLen * Math.cos(thighAngleRadL);
        const kneeYL = hipY + thighLen * Math.sin(thighAngleRadL);

        const shankAngleRadL = (90 + hipAngleL - kneeFlexionL) * rad;
        const ankleXL = kneeXL + shankLen * Math.cos(shankAngleRadL);
        const ankleYL = kneeYL + shankLen * Math.sin(shankAngleRadL);

        const footAngleRadL = (0 + ankleAngleL) * rad;
        const footXL = ankleXL + footLen * Math.cos(footAngleRadL);
        const footYL = ankleYL + footLen * Math.sin(footAngleRadL);

        // Right Leg forward kinematics
        const thighAngleRadR = (90 + hipAngleR) * rad;
        const kneeXR = hipX + thighLen * Math.cos(thighAngleRadR);
        const kneeYR = hipY + thighLen * Math.sin(thighAngleRadR);

        const shankAngleRadR = (90 + hipAngleR - kneeFlexionR) * rad;
        const ankleXR = kneeXR + shankLen * Math.cos(shankAngleRadR);
        const ankleYR = kneeYR + shankLen * Math.sin(shankAngleRadR);

        const footAngleRadR = (0 + ankleAngleR) * rad;
        const footXR = ankleXR + footLen * Math.cos(footAngleRadR);
        const footYR = ankleYR + footLen * Math.sin(footAngleRadR);

        return {
            landmarks: {
                hip: { x: hipX, y: hipY },
                leftKnee: { x: kneeXL, y: kneeYL },
                leftAnkle: { x: ankleXL, y: ankleYL },
                leftFoot: { x: footXL, y: footYL },
                rightKnee: { x: kneeXR, y: kneeYR },
                rightAnkle: { x: ankleXR, y: ankleYR },
                rightFoot: { x: footXR, y: footYR }
            },
            angles: {
                leftKneeFlexion: kneeFlexionL,
                rightKneeFlexion: kneeFlexionR,
                leftHipAngle: hipAngleL,
                rightHipAngle: hipAngleR
            }
        };
    }
}

/**
 * Hardware Adapter Interface
 * Serves as the abstraction point for future physical hardware integration (ESP32/RPi/WebUSB)
 */
export class HardwareAdapter {
    constructor() {
        this.isConnected = false;
        this.mode = 'simulation'; // 'simulation' or 'physical'
        this.simulationEngine = new SimulationEngine();
    }

    async connectPhysical(portConfig = {}) {
        // Future WebSerial / WebUSB / WebSocket physical binding
        console.info('[HardwareAdapter] Physical connection requested. Reverting to simulation in browser environment.');
        this.mode = 'simulation';
        this.isConnected = true;
        return { success: true, mode: 'simulation' };
    }

    acquireStream(durationSeconds = 6.0, pattern = 'normal', patientContext = {}) {
        return this.simulationEngine.generateTrialData(durationSeconds, pattern, patientContext);
    }
}
