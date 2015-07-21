module.exports = function(grunt){
	grunt.initConfig({
		jshint:{
			all:['js/app.js']
		},
		uglify:{
			options: {
 	    	mangle: {
        except: ['jQuery', 'Knockout']
  	    }
    	},
    	my_target: {
      	files: {
        	'dist/js/app.min.js': ['js/app.js']
      }
    },
		},
		concat: {
			dist:{
				files:{
					'dist/js/all.js' :['js/jquery-2.1.4.min.js','js/knockout-3.3.0.js','dist/js/app.min.js']
				}
			}
		},
		csslint:{
			all:['css/style.css']
		},
		cssmin:{
			dist:{
				files: {
					'dist/css/style.min.css' :['css/offline-theme-slide.css','css/style.css']
				}
			}
		},
		imagemin:{
			dynamic:{
				files:[{
					expand:true,
					cwd:'images/',
					src:['**/*.{jpg,gif,png}'],
					dest:'dist/images/'
				}]
			}
		},
		watch:{
			css:{
				files:['css/style.css'],
				tasks:['csslint','cssmin']
			},
			js:{
				files:['js/app.js'],
				tasks:['jshint']
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-imagemin');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-csslint');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-concat');

	grunt.registerTask('default',[
			'jshint',
			'concat',
			'csslint',
			'cssmin',
			'imagemin',
			'uglify'/*,
			'watch'*/
		]);
};