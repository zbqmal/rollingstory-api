/**
 * Test helper utilities
 * This file is created to test branch protection and Copilot Agent configuration
 */

/**
 * Returns a formatted test message with timestamp
 * @param message - The message to format
 * @returns Formatted message string
 */
export function formatTestMessage(message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] ${message}`;
}

/**
 * Simple greeting function for testing
 * @param name - Name to greet
 * @returns Greeting message
 */
export function greet(name: string): string {
  return `Hello, ${name}! Branch protection test successful.`;
}

/**
 * Checks if a value is defined (not null or undefined)
 * @param value - Value to check
 * @returns True if value is defined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
