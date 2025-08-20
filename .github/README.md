# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the Story Text Processing Service. These workflows automate the build, test, deployment, and maintenance of the service.

## Available Workflows

### 1. **Terraform** (`.github/workflows/terraform.yml`)
**Trigger**: Push to `main` branch
**Purpose**: Deploy infrastructure to production

**What it does:**
- Builds and packages the Lambda function
- Runs Terraform plan and apply
- Deploys the complete infrastructure
- Comments on commits with deployment status

**Required Secrets:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### 2. **Terraform Commit Check** (`.github/workflows/terraform-commit.yml`)
**Trigger**: Push to any branch (except main/master/develop)
**Purpose**: Validate infrastructure changes without deploying

**What it does:**
- Builds and packages the Lambda function
- Runs Terraform plan (no apply)
- Comments on commits with plan results
- Validates infrastructure changes

**Required Secrets:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### 3. **Terraform Destroy** (`.github/workflows/terraform-destroy.yml`)
**Trigger**: Manual workflow dispatch
**Purpose**: Remove all infrastructure resources

**What it does:**
- Shows destroy plan
- Requires manual confirmation
- Destroys all resources
- Comments on commits with destroy status

**Required Secrets:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`



## Workflow Triggers

| Workflow | Trigger | Branch | Action |
|----------|---------|---------|---------|
| Terraform | Push | `main` | Deploy to production |
| Commit Check | Push | Any (except main/master/develop) | Validate changes |
| Destroy | Manual | Any | Remove infrastructure |

## Required GitHub Secrets

### AWS Credentials
```bash
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```



## Workflow Permissions

Each workflow requests specific permissions:

- **contents: read** - Read repository contents
- **pull-requests: write** - Comment on pull requests
- **id-token: write** - AWS OIDC authentication
- **actions: read** - Read workflow information

## Manual Workflow Execution

### Destroy Infrastructure
1. Go to Actions tab in GitHub
2. Select "Terraform Destroy" workflow
3. Click "Run workflow"
4. Choose environment (production/staging/development)
5. Type "DESTROY" to confirm
6. Click "Run workflow"



## Workflow Outputs

### Terraform Deployments
- **Success**: Infrastructure deployed, commit commented
- **No Changes**: Infrastructure up-to-date
- **Failure**: Plan errors, deployment skipped

### Commit Checks
- **Success**: Changes validated, plan shown
- **Failure**: Validation errors, plan failed

### Destroy Operations
- **Success**: All resources removed
- **Failure**: Destroy plan failed

## Troubleshooting

### Common Issues

1. **AWS Credentials Invalid**
   - Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets
   - Check AWS IAM permissions

2. **Terraform State Locked**
   - Check if another workflow is running
   - Verify S3 backend configuration

3. **Build Failures**
   - Check Node.js version compatibility
   - Verify TypeScript compilation
   - Check package.json dependencies



### Debug Steps

1. **Check Workflow Logs**
   - Go to Actions tab
   - Click on failed workflow run
   - Review step-by-step logs

2. **Verify Secrets**
   - Go to Settings > Secrets and variables > Actions
   - Verify required secrets are set

3. **Check Branch Protection**
   - Ensure workflows can run on target branches
   - Verify required status checks

## Best Practices

1. **Always Review Plans**
   - Check Terraform plan output before applying
   - Understand what resources will be created/modified

2. **Test Changes**
   - Use commit check workflow for non-main branches
   - Test Lambda function packaging before deployment



4. **Backup State**
   - Ensure Terraform state is backed up to S3
   - Use state locking to prevent conflicts

## Support

For workflow issues:
1. Check workflow logs for error details
2. Verify required secrets and permissions
3. Review AWS credentials and permissions
4. Check Terraform configuration syntax
