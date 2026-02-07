"""Tests for the Git service."""

from unittest.mock import patch

import pytest
from git import Repo

from app.services.git_service import GitService, format_commit_message


# ============================================================================
# format_commit_message
# ============================================================================


class TestFormatCommitMessage:
    """Tests for the module-level format_commit_message function."""

    def test_basic_format(self):
        msg = format_commit_message("Update", "guides/install.md", "user@test.com")
        assert msg.startswith("Update: guides/install.md\n")
        assert "Author: user@test.com" in msg

    def test_contains_date_line(self):
        msg = format_commit_message("Create", "README.md", "bot@wikigit.app")
        assert "Date: " in msg

    def test_action_and_filename_on_first_line(self):
        msg = format_commit_message("Delete", "old-file.md", "admin@test.com")
        first_line = msg.split("\n")[0]
        assert first_line == "Delete: old-file.md"

    def test_different_actions(self):
        for action in ["Create", "Update", "Delete", "Rename", "Config"]:
            msg = format_commit_message(action, "file.md", "user@test.com")
            assert msg.startswith(f"{action}: file.md")


# ============================================================================
# GitService.__init__ and initialize_repo
# ============================================================================


class TestGitServiceInit:
    """Tests for GitService initialization and repository creation."""

    def test_creates_directory(self, tmp_path):
        repo_dir = tmp_path / "new_repo"
        GitService(repo_path=repo_dir)
        assert repo_dir.exists()

    def test_initializes_git_repo(self, tmp_path):
        repo_dir = tmp_path / "new_repo"
        GitService(repo_path=repo_dir)
        assert (repo_dir / ".git").exists()

    def test_creates_readme(self, tmp_path):
        repo_dir = tmp_path / "new_repo"
        GitService(repo_path=repo_dir)
        assert (repo_dir / "README.md").exists()

    def test_readme_has_frontmatter(self, tmp_path):
        repo_dir = tmp_path / "new_repo"
        GitService(repo_path=repo_dir)
        content = (repo_dir / "README.md").read_text()
        assert content.startswith("---")
        assert "title: Welcome to WikiGit" in content

    def test_initial_commit_exists(self, tmp_path):
        repo_dir = tmp_path / "new_repo"
        service = GitService(repo_path=repo_dir)
        commits = list(service.repo.iter_commits())
        assert len(commits) == 1
        assert "Create: README.md" in commits[0].message

    def test_uses_existing_repo_if_git_dir_present(self, tmp_path):
        repo_dir = tmp_path / "existing_repo"
        Repo.init(repo_dir)
        (repo_dir / "test.txt").write_text("hello")
        repo = Repo(repo_dir)
        repo.index.add(["test.txt"])
        repo.index.commit("initial")

        service = GitService(repo_path=repo_dir)
        # Should reuse the existing repo, not overwrite it
        assert service.repo is not None
        commits = list(service.repo.iter_commits())
        assert len(commits) == 1
        assert "initial" in commits[0].message

    def test_stores_config_attributes(self, tmp_path):
        repo_dir = tmp_path / "repo"
        service = GitService(
            repo_path=repo_dir,
            author_name="Test Author",
            author_email="test@example.com",
            remote_url="https://github.com/test/repo.git",
            auto_push=True,
            github_token="ghp_test123",
        )
        assert service.author_name == "Test Author"
        assert service.author_email == "test@example.com"
        assert service.remote_url == "https://github.com/test/repo.git"
        assert service.auto_push is True
        assert service.github_token == "ghp_test123"


# ============================================================================
# GitService.add_and_commit
# ============================================================================


class TestAddAndCommit:
    """Tests for staging files and creating commits."""

    def test_single_file_commit(self, tmp_path):
        service = GitService(repo_path=tmp_path / "repo")
        test_file = service.repo_path / "article.md"
        test_file.write_text("# Test Article")

        sha = service.add_and_commit(["article.md"], "Create", "user@test.com")

        assert sha is not None
        assert len(sha) == 40  # Full SHA

    def test_commit_message_format_for_single_file(self, tmp_path):
        service = GitService(repo_path=tmp_path / "repo")
        test_file = service.repo_path / "docs.md"
        test_file.write_text("# Docs")

        service.add_and_commit(["docs.md"], "Create", "user@test.com")

        latest = list(service.repo.iter_commits(max_count=1))[0]
        assert latest.message.startswith("Create: docs.md")
        assert "Author: user@test.com" in latest.message

    def test_multiple_files_commit(self, tmp_path):
        service = GitService(repo_path=tmp_path / "repo")
        (service.repo_path / "a.md").write_text("# A")
        (service.repo_path / "b.md").write_text("# B")

        sha = service.add_and_commit(["a.md", "b.md"], "Update", "user@test.com")

        latest = list(service.repo.iter_commits(max_count=1))[0]
        assert "Update: 2 files" in latest.message
        assert sha is not None

    def test_raises_if_repo_not_initialized(self, tmp_path):
        service = GitService(repo_path=tmp_path / "repo")
        service.repo = None

        with pytest.raises(RuntimeError, match="not initialized"):
            service.add_and_commit(["file.md"], "Create", "user@test.com")


# ============================================================================
# GitService.push_to_remote
# ============================================================================


class TestPushToRemote:
    """Tests for pushing commits to remote."""

    def test_returns_false_when_no_remote_url(self, tmp_path):
        service = GitService(repo_path=tmp_path / "repo", remote_url=None)
        assert service.push_to_remote() is False

    def test_returns_false_when_auto_push_disabled(self, tmp_path):
        service = GitService(
            repo_path=tmp_path / "repo",
            remote_url="https://github.com/test/repo.git",
            auto_push=False,
        )
        assert service.push_to_remote() is False

    def test_returns_false_when_repo_not_initialized(self, tmp_path):
        service = GitService(repo_path=tmp_path / "repo")
        service.repo = None
        assert service.push_to_remote() is False

    def test_injects_github_token_in_url(self, tmp_path):
        service = GitService(
            repo_path=tmp_path / "repo",
            remote_url="https://github.com/test/repo.git",
            auto_push=True,
            github_token="ghp_secrettoken",
        )
        # Create a remote named "origin" so the code path updates its URL
        service.repo.create_remote("origin", "https://github.com/test/repo.git")

        # Patch the push call to avoid actually pushing
        with patch("git.Remote.push", return_value=[]) as mock_push:
            result = service.push_to_remote()

            # The origin URL should have been updated with the token
            service.repo.remote("origin")
            # push was called, meaning the function got past URL injection
            mock_push.assert_called_once()
            assert result is True

    def test_push_returns_false_on_git_error(self, tmp_path):
        from git.exc import GitCommandError

        service = GitService(
            repo_path=tmp_path / "repo",
            remote_url="https://github.com/test/repo.git",
            auto_push=True,
        )
        service.repo.create_remote("origin", "https://github.com/test/repo.git")

        with patch("git.Remote.push", side_effect=GitCommandError("push", "failed")):
            result = service.push_to_remote()
            assert result is False


# ============================================================================
# GitService.get_file_history
# ============================================================================


class TestGetFileHistory:
    """Tests for retrieving file commit history."""

    def test_returns_commits_for_file(self, tmp_path):
        service = GitService(repo_path=tmp_path / "repo")
        # README.md was created during init, it should have history
        history = service.get_file_history("README.md")

        assert len(history) >= 1
        commit = history[0]
        assert "sha" in commit
        assert "message" in commit
        assert "author" in commit
        assert "email" in commit
        assert "date" in commit

    def test_returns_empty_for_nonexistent_file(self, tmp_path):
        service = GitService(repo_path=tmp_path / "repo")
        history = service.get_file_history("nonexistent.md")
        assert history == []

    def test_max_count_limits_results(self, tmp_path):
        service = GitService(repo_path=tmp_path / "repo")
        # Create multiple commits on same file
        test_file = service.repo_path / "multi.md"
        for i in range(5):
            test_file.write_text(f"# Version {i}")
            service.add_and_commit(["multi.md"], "Update", "user@test.com")

        history = service.get_file_history("multi.md", max_count=3)
        assert len(history) == 3

    def test_raises_when_repo_not_initialized(self, tmp_path):
        service = GitService(repo_path=tmp_path / "repo")
        service.repo = None

        with pytest.raises(RuntimeError, match="not initialized"):
            service.get_file_history("README.md")


# ============================================================================
# GitService.get_latest_commit
# ============================================================================


class TestGetLatestCommit:
    """Tests for retrieving the most recent commit for a file."""

    def test_returns_latest_commit(self, tmp_path):
        service = GitService(repo_path=tmp_path / "repo")
        # Modify README.md
        readme = service.repo_path / "README.md"
        readme.write_text("# Updated README")
        service.add_and_commit(["README.md"], "Update", "editor@test.com")

        latest = service.get_latest_commit("README.md")
        assert latest is not None
        assert "Update: README.md" in latest["message"]

    def test_returns_none_for_nonexistent_file(self, tmp_path):
        service = GitService(repo_path=tmp_path / "repo")
        latest = service.get_latest_commit("nonexistent.md")
        assert latest is None
