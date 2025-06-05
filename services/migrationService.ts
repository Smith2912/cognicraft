import { authService } from './authService.js';
import { projectService } from './projectService.js';
import { APP_CONFIG } from './config.js';

export interface MigrationStatus {
  needsMigration: boolean;
  hasLocalData: boolean;
  isAuthenticated: boolean;
  migrationComplete: boolean;
}

export interface MigrationResult {
  success: boolean;
  migratedProjects: number;
  errors: string[];
  details: string;
}

class MigrationService {
  // Check if migration is needed
  public checkMigrationStatus(): MigrationStatus {
    return {
      needsMigration: this.needsMigration(),
      hasLocalData: authService.hasLocalStorageData(),
      isAuthenticated: authService.isAuthenticated(),
      migrationComplete: authService.isMigrationComplete(),
    };
  }

  // Determine if migration is needed
  private needsMigration(): boolean {
    return (
      authService.hasLocalStorageData() && 
      authService.isAuthenticated() && 
      !authService.isMigrationComplete()
    );
  }

  // Perform the migration
  public async performMigration(): Promise<MigrationResult> {
    const status = this.checkMigrationStatus();
    
    if (!status.isAuthenticated) {
      return {
        success: false,
        migratedProjects: 0,
        errors: ['User must be authenticated to perform migration'],
        details: 'Please log in with GitHub first',
      };
    }

    if (!status.hasLocalData) {
      return {
        success: true,
        migratedProjects: 0,
        errors: [],
        details: 'No local data to migrate',
      };
    }

    if (status.migrationComplete) {
      return {
        success: true,
        migratedProjects: 0,
        errors: [],
        details: 'Migration already completed',
      };
    }

    try {
      console.log('🔄 Starting localStorage migration...');
      
      // Get local data
      const localData = this.extractLocalStorageData();
      console.log(`📊 Found ${localData.projects.length} projects to migrate`);

      const errors: string[] = [];
      let migratedCount = 0;

      // Migrate each project
      for (const project of localData.projects) {
        try {
          console.log(`📁 Migrating project: ${project.name}`);
          
          // Create project
          const newProject = await projectService.createProject({
            name: project.name,
            github_repo_url: project.githubRepo || undefined,
          });

          // Migrate canvas data if exists
          if (project.nodes.length > 0 || project.edges.length > 0) {
            await projectService.saveCanvasState(newProject.id, {
              nodes: project.nodes,
              edges: project.edges,
              selected_node_ids: [],
              selected_edge_id: undefined,
            });
            console.log(`📝 Migrated ${project.nodes.length} nodes and ${project.edges.length} edges`);
          }

          migratedCount++;
          console.log(`✅ Successfully migrated project: ${project.name}`);
          
        } catch (error) {
          const errorMsg = `Failed to migrate project "${project.name}": ${error}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // Mark migration as complete if we had some success
      if (migratedCount > 0 || localData.projects.length === 0) {
        authService.setMigrationComplete();
        console.log('✨ Migration completed successfully');
      }

      return {
        success: errors.length === 0,
        migratedProjects: migratedCount,
        errors,
        details: `Migrated ${migratedCount} of ${localData.projects.length} projects`,
      };

    } catch (error) {
      console.error('❌ Migration failed:', error);
      return {
        success: false,
        migratedProjects: 0,
        errors: [`Migration failed: ${error}`],
        details: 'An unexpected error occurred during migration',
      };
    }
  }

  // Extract data from localStorage
  private extractLocalStorageData(): { projects: any[]; currentProject: string | null } {
    try {
      const projectsData = localStorage.getItem('cognicraft_projects');
      const currentProject = localStorage.getItem('cognicraft_currentProject');
      
      const projects = projectsData ? JSON.parse(projectsData) : [];
      
      return {
        projects: Array.isArray(projects) ? projects : [],
        currentProject,
      };
    } catch (error) {
      console.error('Error extracting localStorage data:', error);
      return { projects: [], currentProject: null };
    }
  }

  // Clean up localStorage after successful migration
  public cleanupLocalStorage(): void {
    try {
      const keysToRemove = [
        'cognicraft_projects',
        'cognicraft_currentProject',
        'cognicraft_nodes',
        'cognicraft_edges',
        'cognicraft_chat',
        'cognicraft_history',
        'cognicraft_user', // Old user data
      ];

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      console.log('🧹 Cleaned up localStorage data');
    } catch (error) {
      console.error('Error cleaning up localStorage:', error);
    }
  }

  // Force reset migration status (for testing)
  public resetMigrationStatus(): void {
    localStorage.removeItem(APP_CONFIG.MIGRATION_KEY);
  }

  // Get migration guidance message
  public getMigrationGuidance(status: MigrationStatus): string {
    if (!status.hasLocalData && status.isAuthenticated) {
      return "You're all set! No local data to migrate.";
    }
    
    if (!status.isAuthenticated && status.hasLocalData) {
      return "Please log in with GitHub to migrate your local projects to the cloud.";
    }
    
    if (status.needsMigration) {
      return "We found local projects that can be migrated to your account. Would you like to migrate them now?";
    }
    
    if (status.migrationComplete) {
      return "Migration completed! Your projects are now stored in the cloud.";
    }
    
    return "Ready to start using CogniCraft!";
  }
}

// Export singleton instance
export const migrationService = new MigrationService(); 