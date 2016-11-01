module.exports = function (grunt) {

  'use strict';

  grunt.initConfig({

    pkg: grunt.file.readJSON('package.json'),

    // Bumpup version
    bumpup: {
      options: {
        updateProps: {
          pkg: 'package.json'
        }
      },
      files: ['package.json']
    },

    // Uglify DOES NOT support ES6 !!!
    // uglify: {
    //   options: {
    //     banner: "/*\n\n" + grunt.file.read('BANNER') + "\n\n" + grunt.file.read('LICENSE.txt') + "*/\n\n",
    //     compress: {
    //       drop_console: true
    //     },
    //     mangle: false,
    //     preserveComments: false
    //   },
    //   build: {
    //     src: './src/<%= pkg.name %>.js',
    //     dest: './<%= pkg.name %>.min.js'
    //   }
    // },

    concat: {
      options: {
        banner: "/*\n\n" + grunt.file.read('BANNER') + "\n\n" + grunt.file.read('LICENSE.txt') + "*/\n\n",
      },
      dist: {
        src: ['./src/<%= pkg.name %>.js'],
        dest: './<%= pkg.name %>.js',
      },
    },

    // // Generate doc
    jsdoc : {
      dist : {
        src: ['./src/*.js'],
        options: {
          destination: './docs',
          template : "./jsdoc/docdash",
          configure : "./jsdoc/jsdoc.json",
          readme: "./README.md",
          query: "name=<%= pkg.name %>&version=<%= pkg.version %>&author=<%= pkg.author %>"
        }
      }
    },

    // Files that are copied or written over must be re-committed.
    gitcommit: {
      "commitupdated": {
        options: {
          message: 'Release <%= pkg.version %>.',
          noVerify: true,
          noStatus: false
        },
        files: {
          src: ['<%= pkg.name %>.js', 'docs']
        }
      }
    },

    // Push documentation to GitHub pages
    'gh-pages': {
      options: {
        base: './docs'
      },
      src: ['**/*']
    },

    release: {
      options: {
        bump: false,
        commitMessage: 'Release <%= version %>'
      }
    }

  });

  grunt.loadNpmTasks('grunt-bumpup');
  grunt.loadNpmTasks('grunt-contrib-concat');
  // grunt.loadNpmTasks('grunt-contrib-clean');
  // grunt.loadNpmTasks('grunt-contrib-compress');
  // grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-gh-pages');
  grunt.loadNpmTasks('grunt-git');
  grunt.loadNpmTasks('grunt-release');
  grunt.loadNpmTasks('grunt-jsdoc');

  grunt.registerTask('publish', ['publish:prerelease']);
  grunt.registerTask("publish:prerelease", ['bumpup:prerelease', 'concat', 'jsdoc', 'gitcommit:commitupdated', 'gh-pages', 'release']);
  grunt.registerTask("publish:patch", ['bumpup:patch', 'yuidoc', 'release']);
  grunt.registerTask('publish:minor', ['bumpup:minor', 'yuidoc', 'release']);
  grunt.registerTask('publish:major', ['bumpup:major', 'yuidoc', 'release']);

};
