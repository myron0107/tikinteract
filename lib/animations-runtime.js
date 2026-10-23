import {createAnimationStore} from './animations-store.js';
import {createAnimationService} from './animations-service.js';
import {createAnimationBilling} from './animations-billing.js';
export const animationStore=createAnimationStore();
export const animationBilling=createAnimationBilling({store:animationStore});
export const animationService=createAnimationService({store:animationStore,stripe:animationBilling});
