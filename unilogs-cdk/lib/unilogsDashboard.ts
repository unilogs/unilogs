export const unilogsDashboard = JSON.stringify({
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": {
          "type": "grafana",
          "uid": "-- Grafana --"
        },
        "enable": true,
        "hide": true,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  },
  "description": "Default dashboard provided by Unilogs",
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 0,
  "id": 1,
  "links": [],
  "panels": [
    {
      "datasource": {
        "type": "loki",
        "uid": "P8E80F9AEF21F6940"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "green"
              },
              {
                "color": "#EAB839",
                "value": 150
              },
              {
                "color": "red",
                "value": 250
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 0
      },
      "id": 1,
      "options": {
        "minVizHeight": 75,
        "minVizWidth": 75,
        "orientation": "auto",
        "reduceOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "fields": "",
          "values": false
        },
        "showThresholdLabels": false,
        "showThresholdMarkers": true,
        "sizing": "auto"
      },
      "pluginVersion": "11.6.1",
      "targets": [
        {
          "datasource": {
            "type": "loki",
            "uid": "P8E80F9AEF21F6940"
          },
          "direction": "backward",
          "editorMode": "code",
          "expr": "sum by (service_name) (\r\n  count_over_time(\r\n    {agent=\"vector\"} \r\n    | level = `error`\r\n    [1h]\r\n  )\r\n)",
          "hide": false,
          "queryType": "range",
          "refId": "A"
        }
      ],
      "title": "level=\"error\" by service_name [1h]",
      "type": "gauge"
    },
    {
      "datasource": {
        "type": "loki",
        "uid": "P8E80F9AEF21F6940"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "yellow"
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 8
      },
      "id": 2,
      "options": {
        "minVizHeight": 75,
        "minVizWidth": 75,
        "orientation": "auto",
        "reduceOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "fields": "",
          "values": false
        },
        "showThresholdLabels": false,
        "showThresholdMarkers": true,
        "sizing": "auto"
      },
      "pluginVersion": "11.6.1",
      "targets": [
        {
          "direction": "backward",
          "editorMode": "code",
          "expr": "sum by (service_name) (\r\n  count_over_time(\r\n    {agent=\"vector\"} \r\n    | level = `error`\r\n    [1h]\r\n  )\r\n)",
          "queryType": "range",
          "refId": "A"
        }
      ],
      "title": "level=\"info\" by service_name [1h]",
      "type": "gauge"
    },
    {
      "datasource": {
        "type": "loki",
        "uid": "P8E80F9AEF21F6940"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "green"
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 16
      },
      "id": 3,
      "options": {
        "minVizHeight": 75,
        "minVizWidth": 75,
        "orientation": "auto",
        "reduceOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "fields": "",
          "values": false
        },
        "showThresholdLabels": false,
        "showThresholdMarkers": true,
        "sizing": "auto"
      },
      "pluginVersion": "11.6.1",
      "targets": [
        {
          "direction": "backward",
          "editorMode": "code",
          "expr": "sum by (service_name) (\r\n  count_over_time(\r\n    {agent=\"vector\"} \r\n    | level = `info`\r\n    [1h]\r\n  )\r\n)",
          "queryType": "range",
          "refId": "A"
        }
      ],
      "title": "level=\"info\" by service_name [1h]",
      "type": "gauge"
    }
  ],
  "preload": false,
  "schemaVersion": 41,
  "tags": [],
  "templating": {
    "list": []
  },
  "time": {
    "from": "now-6h",
    "to": "now"
  },
  "timepicker": {},
  "timezone": "browser",
  "title": "Unilogs default",
  "uid": "dejwgzh6wt6v4f",
  "version": 14
});
