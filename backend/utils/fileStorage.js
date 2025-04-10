const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const { config } = require('../config/config');

// Promisify file system operations
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const copyFile = promisify(fs.copyFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

/**
 * File storage utility for handling uploaded files
 */
class FileStorage {
  /**
   * Initialize file storage with base directory
   * @param {string} baseDir - Base directory for file storage
   */
  constructor(baseDir = config.uploads.path) {
    this.baseDir = baseDir;
    this.ensureDirectories();
  }
  
  /**
   * Ensure storage directories exist
   */
  async ensureDirectories() {
    try {
      // Create base directory if it doesn't exist
      if (!fs.existsSync(this.baseDir)) {
        await mkdir(this.baseDir, { recursive: true });
      }
      
      // Create subdirectories
      const subdirs = ['documents', 'profiles', 'receipts', 'temp'];
      
      for (const dir of subdirs) {
        const dirPath = path.join(this.baseDir, dir);
        if (!fs.existsSync(dirPath)) {
          await mkdir(dirPath, { recursive: true });
        }
      }
    } catch (error) {
      logger.error('Error creating storage directories:', error);
      throw error;
    }
  }
  
  /**
   * Save a file from a buffer
   * @param {Buffer} buffer - File buffer
   * @param {string} filename - Original filename
   * @param {string} type - File type (documents, profiles, receipts)
   * @returns {Promise<string>} Saved file path
   */
  async saveBuffer(buffer, filename, type = 'documents') {
    try {
      // Validate file type
      if (!['documents', 'profiles', 'receipts', 'temp'].includes(type)) {
        throw new Error(`Invalid file type: ${type}`);
      }
      
      // Generate unique filename with original extension
      const ext = path.extname(filename);
      const uniqueFilename = `${uuidv4()}${ext}`;
      const filePath = path.join(this.baseDir, type, uniqueFilename);
      
      // Write file
      await writeFile(filePath, buffer);
      
      // Return relative path for storage in database
      return `/uploads/${type}/${uniqueFilename}`;
    } catch (error) {
      logger.error('Error saving file buffer:', error);
      throw error;
    }
  }
  
  /**
   * Save an uploaded file (from multer)
   * @param {Object} file - Multer file object
   * @param {string} type - File type (documents, profiles, receipts)
   * @returns {Promise<string>} Saved file path
   */
  async saveUploadedFile(file, type = 'documents') {
    try {
      // Validate file type
      if (!['documents', 'profiles', 'receipts', 'temp'].includes(type)) {
        throw new Error(`Invalid file type: ${type}`);
      }
      
      // Generate unique filename with original extension
      const ext = path.extname(file.originalname);
      const uniqueFilename = `${uuidv4()}${ext}`;
      const destPath = path.join(this.baseDir, type, uniqueFilename);
      
      // Copy file from temp upload location
      await copyFile(file.path, destPath);
      
      // Delete temp file
      await unlink(file.path).catch(() => {}); // Ignore errors
      
      // Return relative path for storage in database
      return `/uploads/${type}/${uniqueFilename}`;
    } catch (error) {
      logger.error('Error saving uploaded file:', error);
      throw error;
    }
  }
  
  /**
   * Delete a file
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(filePath) {
    try {
      // Extract filename from path
      const filename = path.basename(filePath);
      
      // Determine file type from path
      const match = filePath.match(/\/uploads\/([^/]+)\//);
      if (!match) {
        throw new Error(`Invalid file path: ${filePath}`);
      }
      
      const type = match[1];
      
      // Full path to file
      const fullPath = path.join(this.baseDir, type, filename);
      
      // Check if file exists
      try {
        await stat(fullPath);
      } catch (err) {
        logger.warn(`File not found for deletion: ${fullPath}`);
        return false;
      }
      
      // Delete file
      await unlink(fullPath);
      return true;
    } catch (error) {
      logger.error('Error deleting file:', error);
      throw error;
    }
  }
  
  /**
   * Read a file
   * @param {string} filePath - Path to file
   * @returns {Promise<Buffer>} File contents
   */
  async readFile(filePath) {
    try {
      // Extract filename from path
      const filename = path.basename(filePath);
      
      // Determine file type from path
      const match = filePath.match(/\/uploads\/([^/]+)\//);
      if (!match) {
        throw new Error(`Invalid file path: ${filePath}`);
      }
      
      const type = match[1];
      
      // Full path to file
      const fullPath = path.join(this.baseDir, type, filename);
      
      // Read and return file
      return await readFile(fullPath);
    } catch (error) {
      logger.error('Error reading file:', error);
      throw error;
    }
  }
  
  /**
   * Check if a file exists
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} Whether file exists
   */
  async fileExists(filePath) {
    try {
      // Extract filename from path
      const filename = path.basename(filePath);
      
      // Determine file type from path
      const match = filePath.match(/\/uploads\/([^/]+)\//);
      if (!match) {
        return false;
      }
      
      const type = match[1];
      
      // Full path to file
      const fullPath = path.join(this.baseDir, type, filename);
      
      // Check if file exists
      try {
        await stat(fullPath);
        return true;
      } catch (err) {
        return false;
      }
    } catch (error) {
      logger.error('Error checking if file exists:', error);
      return false;
    }
  }
  
  /**
   * Get file metadata
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} File metadata
   */
  async getFileInfo(filePath) {
    try {
      // Extract filename from path
      const filename = path.basename(filePath);
      
      // Determine file type from path
      const match = filePath.match(/\/uploads\/([^/]+)\//);
      if (!match) {
        throw new Error(`Invalid file path: ${filePath}`);
      }
      
      const type = match[1];
      
      // Full path to file
      const fullPath = path.join(this.baseDir, type, filename);
      
      // Get file stats
      const stats = await stat(fullPath);
      
      return {
        path: filePath,
        filename,
        type,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        extension: path.extname(filename).toLowerCase()
      };
    } catch (error) {
      logger.error('Error getting file info:', error);
      throw error;
    }
  }
  
  /**
   * List files in a directory
   * @param {string} type - File type (documents, profiles, receipts)
   * @returns {Promise<Array>} List of filenames
   */
  async listFiles(type = 'documents') {
    try {
      // Validate file type
      if (!['documents', 'profiles', 'receipts', 'temp'].includes(type)) {
        throw new Error(`Invalid file type: ${type}`);
      }
      
      // Directory path
      const dirPath = path.join(this.baseDir, type);
      
      // Read directory
      const files = await readdir(dirPath);
      
      return files;
    } catch (error) {
      logger.error('Error listing files:', error);
      throw error;
    }
  }
  
  /**
   * Clean up temporary files older than a certain age
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Promise<number>} Number of files deleted
   */
  async cleanupTempFiles(maxAge = 24 * 60 * 60 * 1000) { // Default: 24 hours
    try {
      const tempDir = path.join(this.baseDir, 'temp');
      const files = await readdir(tempDir);
      const now = Date.now();
      let deleted = 0;
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await stat(filePath);
        
        // Check if file is older than maxAge
        if (now - stats.mtime.getTime() > maxAge) {
          await unlink(filePath);
          deleted++;
        }
      }
      
      return deleted;
    } catch (error) {
      logger.error('Error cleaning up temp files:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
const fileStorage = new FileStorage();
module.exports = fileStorage;