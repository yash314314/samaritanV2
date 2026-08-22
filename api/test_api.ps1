`$project = Invoke-RestMethod -Uri 'http://localhost:4000/api/projects' -Method Post -ContentType 'application/json' -Body '{"userId":"test-user-123","name":"Website Redesign","icon":"🎨","color":"#8b5cf6","weeklyHourGoal":15}'
Write-Host "Project created:`$($project.name) (`$($project.id))"
`$rule = Invoke-RestMethod -Uri ('http://localhost:4000/api/projects/' + `$project.id + '/rules') -Method Post -ContentType 'application/json' -Body '{"appName":"Figma","domain":"figma.com"}'
Write-Host "Rule created:`$(`$rule.appName)"
`$event = Invoke-RestMethod -Uri 'http://localhost:4000/api/calendar' -Method Post -ContentType 'application/json' -Body ('{"userId":"test-user-123","title":"Design Review","startAt":"2026-08-10T10:00:00Z","endAt":"2026-08-10T11:00:00Z","projectId":"' + `$project.id + '"}')`nWrite-Host "Event created:`$(`$event.title)"
`$goal = Invoke-RestMethod -Uri 'http://localhost:4000/api/goals' -Method Post -ContentType 'application/json' -Body ('{"userId":"test-user-123","title":"Design Focus","target":120,"projectId":"' + `$project.id + '"}')`nWrite-Host "Goal created:`$(`$goal.title)"
`$rating = Invoke-RestMethod -Uri 'http://localhost:4000/api/ratings' -Method Post -ContentType 'application/json' -Body '{"userId":"test-user-123","rating":5}'
Write-Host "Rating created:`$(`$rating.rating)"
`$projects = Invoke-RestMethod -Uri 'http://localhost:4000/api/projects?userId=test-user-123' -Method Get
Write-Host "Projects count:`$(`$projects.Count)"
