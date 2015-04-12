requirejs.config({
  baseUrl: 'lib',
  paths: {
    'app': '../app',
    'bacon': 'bacon/dist/Bacon.min',
    'bacon.jquery': 'bacon.jquery/dist/bacon.jquery.min',
    'bacon.model': 'bacon.model/dist/bacon.model.min',
    'handlebars': 'handlebars/handlebars.min',
    'jquery': 'jquery/dist/jquery.min',
  },
  shim: {
    'bacon.jquery': ['jquery', 'bacon', 'bacon.model']
  },
  waitSeconds: 0,
})

requirejs(['app/main'])
