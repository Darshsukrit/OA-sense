/**
 * GAITMATRIX / OA-Sense - Storage & Privacy Architecture Module
 * Local-First Persistence, Pseudonymous Session Management & Privacy Controls
 * 
 * Implements:
 * 1. Offline-First Local Storage (Browser LocalStorage for MVP demonstration)
 * 2. Model Registry Persistence
 * 3. Pseudonymous Screening Session History
 * 4. Data Privacy & Minimization Policy
 */

export class StorageManager {
    constructor() {
        this.STORAGE_KEYS = {
            MODEL_REGISTRY: 'gaitmatrix_model_registry_v1',
            SESSIONS: 'gaitmatrix_screening_sessions_v1',
            ACTIVE_CONFIG: 'gaitmatrix_active_config_v1',
            CONSENT: 'gaitmatrix_user_consent_v1'
        };
        this._initStorage();
    }

    _initStorage() {
        if (!localStorage.getItem(this.STORAGE_KEYS.MODEL_REGISTRY)) {
            const initialRegistry = {
                selectedModel: 'ensemble',
                models: [
                    {
                        id: 'RF-v0.1-demo',
                        name: 'Random Forest Classifier',
                        type: 'randomForest',
                        version: 'v0.1-demo',
                        status: 'Validated Demo Model',
                        dataset: 'Synthetic Demo Dataset (n=350)',
                        trees: 25,
                        maxDepth: 6,
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 'GB-v0.1-demo',
                        name: 'XGBoost-Style Gradient Boosting',
                        type: 'gradientBoosting',
                        version: 'v0.1-demo',
                        status: 'Validated Demo Model',
                        dataset: 'Synthetic Demo Dataset (n=350)',
                        estimators: 20,
                        learningRate: 0.1,
                        createdAt: new Date().toISOString()
                    }
                ]
            };
            localStorage.setItem(this.STORAGE_KEYS.MODEL_REGISTRY, JSON.stringify(initialRegistry));
        }

        if (!localStorage.getItem(this.STORAGE_KEYS.SESSIONS)) {
            localStorage.setItem(this.STORAGE_KEYS.SESSIONS, JSON.stringify([]));
        }
    }

    getModelRegistry() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.MODEL_REGISTRY));
        } catch (e) {
            console.error('Error reading model registry from storage:', e);
            return null;
        }
    }

    saveModelRegistry(registry) {
        try {
            localStorage.setItem(this.STORAGE_KEYS.MODEL_REGISTRY, JSON.stringify(registry));
            return true;
        } catch (e) {
            console.error('Error saving model registry:', e);
            return false;
        }
    }

    saveScreeningSession(session) {
        try {
            const sessions = this.getScreeningSessions();
            // Prepend latest session
            sessions.unshift({
                ...session,
                savedAt: new Date().toISOString()
            });
            // Keep up to 25 latest sessions
            const trimmed = sessions.slice(0, 25);
            localStorage.setItem(this.STORAGE_KEYS.SESSIONS, JSON.stringify(trimmed));
            return true;
        } catch (e) {
            console.error('Error saving session:', e);
            return false;
        }
    }

    getScreeningSessions() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.SESSIONS)) || [];
        } catch (e) {
            console.error('Error loading sessions:', e);
            return [];
        }
    }

    clearSessions() {
        try {
            localStorage.setItem(this.STORAGE_KEYS.SESSIONS, JSON.stringify([]));
            return true;
        } catch (e) {
            return false;
        }
    }

    getPrivacyArchitecture() {
        return {
            title: 'Local-First Privacy & Data Minimization Architecture',
            offlineGuarantee: 'All signal acquisition, digital filtering, kinematic feature extraction, ML model inference, and report generation execute 100% locally on client edge hardware. Zero biometric or sensor telemetry is transmitted over the network.',
            principles: [
                {
                    name: 'Zero Cloud Dependency',
                    desc: 'Core screening operates fully offline without active internet connectivity, guaranteeing functionality in remote rural clinics.'
                },
                {
                    name: 'Pseudonymous Session Identifiers',
                    desc: 'No direct Personally Identifiable Information (PII) such as names, phone numbers, or government IDs is collected or stored.'
                },
                {
                    name: 'Data Minimization',
                    desc: 'Only extracted numerical movement features and session metadata are persisted; raw video streams and high-frequency sensor buffers are discarded after processing.'
                },
                {
                    name: 'Local Storage Disclaimer',
                    desc: 'Browser LocalStorage is utilized for MVP prototyping. Physical edge production deployment will implement encrypted SQLite (SQLCipher) with AES-256 local database encryption.'
                },
                {
                    name: 'Informed Consent Concept',
                    desc: 'Clinical data collection protocols require explicit digital informed consent prior to physical trial initialization.'
                }
            ],
            futureSync: 'Future optional secure telemetry synchronization will require end-to-end asymmetric encryption (TLS 1.3 + Ed25519 signatures) with explicit clinical practitioner opt-in.'
        };
    }
}
