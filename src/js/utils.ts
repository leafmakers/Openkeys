/**
 * A type-safe debounce function that limits the rate at which a function can fire.
 * 
 * @template T The type of the function parameters
 * @template R The return type of the function
 * @param {(...args: T[]) => R} func The function to debounce
 * @param {number} wait The number of milliseconds to delay
 * @returns {(...args: T[]) => void} A debounced version of the function
 * 
 * @example
 * const handleResize = debounce((event: UIEvent) => {
 *   console.log('Window resized');
 * }, 250);
 * 
 * window.addEventListener('resize', handleResize);
 */
export function debounce(func: (...args: any[]) => any, wait: number) {
  let timeoutId: NodeJS.Timeout | undefined;
  
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeoutId as NodeJS.Timeout);
      func(...args);
    };
    
    clearTimeout(timeoutId as NodeJS.Timeout);
    timeoutId = setTimeout(later, wait);
  };
}

/**
 * Throttles a function to only execute once within a specified time period.
 * 
 * @template T The type of the function parameters
 * @template R The return type of the function
 * @param {(...args: T[]) => R} func The function to throttle
 * @param {number} limit The time limit in milliseconds
 * @returns {(...args: T[]) => void} A throttled version of the function
 * 
 * @example
 * const handleScroll = throttle((event: UIEvent) => {
 *   console.log('Scrolling');
 * }, 100);
 * 
 * window.addEventListener('scroll', handleScroll);
 */
export function throttle(func: (...args: any[]) => any, limit: number) {
  let inThrottle: boolean;
  
  return function executedFunction(...args: any[]) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Creates a promise that resolves after a specified delay.
 * 
 * @param {number} ms The delay in milliseconds
 * @returns {Promise<void>} A promise that resolves after the delay
 * 
 * @example
 * async function example() {
 *   console.log('Start');
 *   await delay(1000);
 *   console.log('End after 1 second');
 * }
 */
export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clamps a number between a minimum and maximum value.
 * 
 * @param {number} value The number to clamp
 * @param {number} min The minimum value
 * @param {number} max The maximum value
 * @returns {number} The clamped value
 * 
 * @example
 * const value = clamp(150, 0, 100); // returns 100
 */
export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values.
 * 
 * @param {number} start The start value
 * @param {number} end The end value
 * @param {number} t The interpolation factor (0-1)
 * @returns {number} The interpolated value
 * 
 * @example
 * const value = lerp(0, 100, 0.5); // returns 50
 */
export function lerp(start: number, end: number, t: number) {
  return start * (1 - t) + end * t;
}

/**
 * Eases a value using a quadratic ease-in-out function.
 * 
 * @param {number} t The value to ease (0-1)
 * @returns {number} The eased value
 * 
 * @example
 * const value = easeInOut(0.5); // returns smooth interpolated value
 */
export function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Generates a random number between min and max (inclusive).
 * 
 * @param {number} min The minimum value
 * @param {number} max The maximum value
 * @returns {number} A random number between min and max
 * 
 * @example
 * const value = random(1, 10); // returns random number between 1 and 10
 */
export function random(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Formats a number with specified decimal places.
 * 
 * @param {number} value The number to format
 * @param {number} [decimals=2] The number of decimal places
 * @returns {string} The formatted number
 * 
 * @example
 * const value = formatNumber(123.4567, 2); // returns "123.46"
 */
export function formatNumber(value: number, decimals: number = 2) {
  return Number(Math.round(parseFloat(value + 'e' + decimals)) + 'e-' + decimals).toFixed(decimals);
}

/**
 * Checks if a value is between two numbers (inclusive).
 * 
 * @param {number} value The value to check
 * @param {number} min The minimum value
 * @param {number} max The maximum value
 * @returns {boolean} True if the value is between min and max
 * 
 * @example
 * const isInRange = isBetween(5, 1, 10); // returns true
 */
export function isBetween(value: number, min: number, max: number) {
  return value >= min && value <= max;
}