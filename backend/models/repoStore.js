// Add the URLs of the repositories you want to track here!
// It can be your own repos, or a student's repo.
// As long as your GitHub token has access to it, it will work.
let repositories = [
  {
    id: 1,
    repoUrl: "https://github.com/Lalindu0923/GitHubMonitor", // Example: Your own repository
  },
  {
    id: 2,
    repoUrl: "https://github.com/SomeStudent/TheirProject", // Example: A student's repository
  },
];

export function addRepository(repoUrl) {
  repositories.push({
    id: Date.now(),
    repoUrl,
  });
}

export function getRepositories() {
  return repositories;
}

export default {
  addRepository,
  getRepositories,
};
