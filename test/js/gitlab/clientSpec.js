const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
const nock = require('nock');
const config = require('config');

const GitlabClient = require('../../../src/gitlab/client.js');
const Project = require('../../../src/gitlab/model/project.js');
const Subgroup = require('../../../src/gitlab/model/subgroup.js');
const groupDetails = require('../../resources/gitlab/groupDetails.json');
const subgroupsList = require('../../resources/gitlab/subgroupsList.json');
const subgroupDetails = require('../../resources/gitlab/subgroup1Details.json');
const archiveResponse = require('../../resources/gitlab/archiveResponse.json');

describe('Gitlab client', function() {
	const GITLAB_URL = config.get('gl2gh.gitlab.url');
	const GITLAB_PRIVATE_TOKEN = config.get('gl2gh.gitlab.token');
	const gitlabClient = new GitlabClient(GITLAB_URL, GITLAB_PRIVATE_TOKEN);
	let api;
	beforeEach(() => {
		api = nock(
			'https://' + GITLAB_URL, {
				reqHeaders: {
					'Content-Type': 'application/json',
					'User-Agent': 'gl2h',
					'Private-Token': GITLAB_PRIVATE_TOKEN
				}
			}
		);
	});

	afterEach(() => {
		nock.cleanAll();
	});
	describe('#getGroup', function() {
		it('should return details for the group with name FOO', async() => {
			//given
			const groupName = 'FOO';
			api.get('/api/v4/groups/'+groupName).reply(200, groupDetails);
			//when
			const group = await gitlabClient.getGroup(groupName);
			//then
			const projectList = group.getProjects();
			projectList.should.be.an('array');
			projectList.should.have.lengthOf(3);
			projectList[0].should.be.a('object');
			projectList[0].should.be.instanceof(Project);
			projectList[0].should.have.property('name');
			projectList[0].should.have.property('http_url_to_repo');
			
		});
		it('should return shared-projects for the group with name FOO', async() => {
			//given
			const groupName = 'FOO';
			api.get('/api/v4/groups/'+groupName).reply(200, groupDetails);
			//when
			const group = await gitlabClient.getGroup(groupName);
			//then
			const projectList = group.getSharedProjects();
			projectList.should.be.an('array');
			projectList.should.have.lengthOf(1);
			projectList[0].should.be.a('object');
			projectList[0].should.be.instanceof(Project);
			projectList[0].should.have.property('name');
			projectList[0].should.have.property('http_url_to_repo');
			
		});
		it('should throw error when group not found', async() => {
			//given
			const groupName = 'non-existing-group';
			api.get('/api/v4/groups/'+groupName).reply(404);
			//when
			//when
			return assert.isRejected(
				gitlabClient.getGroup(groupName),
				Error,
				`No group found with name ${groupName}`
			);
		});
		it('should throw error when error obtained while fetching group', async() => {
			//given
			const groupName = 'error';
			api.get('/api/v4/groups/'+groupName).replyWithError('some error occurred while fetching group');
			//when
			return assert.isRejected(
				gitlabClient.getGroup(groupName),
				Error,
				`Error while fetching GitLab group: ${groupName}`
			);
		});
	});
	describe('#getSubgroups', function() {
		it('should return list of subgroups within the group', async() => {
			//given
			const groupName = 'FOO';
			api.get('/api/v4/groups/'+groupName+'/subgroups').reply(200, subgroupsList);
			//when
			const subgroups = await gitlabClient.getSubgroups(groupName);
			//then
			subgroups.should.be.an('array');
			subgroups.should.have.lengthOf(2);
			subgroups[0].should.be.a('object');
			subgroups[0].should.be.instanceof(Subgroup);
			subgroups[0].should.have.property('name');
			
		});
		it('should throw error when fetching subgroups and group not found', async() => {
			//given
			const groupName = 'non-existing-group';
			api.get('/api/v4/groups/'+groupName+'/subgroups').reply(404);
			//when
			return assert.isRejected(
				gitlabClient.getSubgroups(groupName),
				Error,
				`No group found with name ${groupName}, cant fetch subgroups`
			);
		});
		it('should throw error when error obtained while fetching subgroups', async() => {
			//given
			const groupName = 'error';
			api.get('/api/v4/groups/'+groupName+'/subgroups').replyWithError('some error occurred while fetching group');
			//when
			return assert.isRejected(
				gitlabClient.getSubgroups(groupName),
				Error,
				'Error while fetching subgroups'
			);
		});
	});
	describe('#getSubgroup', function() {
		it('should return details for the subgroup with name subgroup1', async() => {
			//given
			var groupName = 'FOO';
			var subgroupName = 'subgroup1';
			api.get('/api/v4/groups/'+groupName+encodeURIComponent('/')+subgroupName).reply(200, subgroupDetails);
			//when
			var subgroup = await gitlabClient.getSubgroup(groupName, subgroupName);
			//then
			var projectList = subgroup.getProjects();
			projectList.should.be.an('array');
			projectList.should.have.lengthOf(2);
			projectList[0].should.be.a('object');
			projectList[0].should.be.instanceof(Project);
			projectList[0].should.have.property('name');
			projectList[0].should.have.property('http_url_to_repo');
			
		});
		it('should throw error when subgroup not found', async() => {
			//given
			const groupName = 'FOO';
			const subgroupName = 'non-existing-group';
			api.get('/api/v4/groups/'+groupName+encodeURIComponent('/')+subgroupName).reply(404);
			//when
			return assert.isRejected(
				gitlabClient.getSubgroup(groupName, subgroupName),
				Error,
				`No subgroup found with name ${subgroupName}`
			);
		});
		it('should throw error when error obtained while fetching subgroup', async() => {
			//given
			const groupName = 'FOO';
			const subgroupName = 'error';
			api.get('/api/v4/groups/'+groupName+encodeURIComponent('/')+subgroupName).replyWithError('some error occurred while fetching subgroup');
			//when
			return assert.isRejected(
				gitlabClient.getSubgroup(groupName, subgroupName),
				Error,
				`Error while fetching subgroup ${subgroupName}`
			);
		});
	});
	describe('#archiveRepo', function () {
		it('should archive the project for the given project path', async () => {
			//given
			const projectPath = 'foo/sample-project-site';
			api.post('/api/v4/projects/' + encodeURIComponent(projectPath) + '/archive').reply(200, archiveResponse);
			//when
			const response = await gitlabClient.archiveProject(projectPath);
			//then
			const archiveResponseObj = response.data;
			expect(archiveResponseObj.path_with_namespace).to.equal(projectPath);
			expect(archiveResponseObj.archived).to.be.true;
		});
		it('should throw error when project path not found', async () => {
			//given
			const projectPath = 'foo/invalid-project';
			api.post('/api/v4/projects/' + encodeURIComponent(projectPath) + '/archive').reply(404);
			//when
			return assert.isRejected(
				gitlabClient.archiveProject(projectPath),
				Error,
				`No project found in the path ${projectPath}, for archiving`);
		});
		it('should throw error when error obtained while archiving project', async () => {
			//given
			const projectPath = 'foo/invalid-project';
			api.post('/api/v4/projects/' + encodeURIComponent(projectPath) + '/archive').replyWithError('Some error occurred while archiving project');
			//when
			return assert.isRejected(
				gitlabClient.archiveProject(projectPath),
				Error,
				'Error while archiving project foo/invalid-project');
		});
	});
});