# Webhook for Slack Notification

## Purpose

This webhook is used to send notifications to a Slack channel when a run fails.

## How it works

When a run fails 3 consecutive times, the webhook will send a notification to a Slack channel with the following information:
- Group Name
- Number of failed URLs

## Endpoint

`POST /slack/notification`

## Request Body

```json
{
  "group_name": "example",
  "failure_count": 10
}
```