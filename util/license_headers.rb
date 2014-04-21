#!/usr/bin/env ruby

#L
# Copyright Northwestern University.
#
# Distributed under the OSI-approved BSD 3-Clause License.
# 
#L

######
# Run this script to add/update NCIP's mandatory license headers or to verify
# the presence of the headers in all applicable files.
#
# Usage:
#   $ cd {PSC_WORKING_ROOT}
#   $ ruby license_headers.rb [update|check]
#
# The `update` subcommand applies the current license to all applicable files.
#
# The `check` subcommand verifies that all applicable files have the license. If
# any are missing the license, it exits with a status of 1 and prints a
# descriptive message to standard out.

###### UPDATE STRATEGIES

class LicenseUpdater
  LICENSE_TOKEN = /\{LICENSE\}/

  LICENSE_HEADER_TEXT = <<-TEXT
Copyright SAIC, SAIC-Frederick.

Distributed under the OSI-approved BSD 3-Clause License.
See http://ncip.github.com/caadapter/LICENSE.txt for details.
TEXT

  attr_reader :filename, :contents

  def initialize(filename)
    @filename = filename
    @contents = File.read(filename)
  end

  def needs_update?
    new_contents != contents
  end

  def update
    File.open(filename, 'w') { |f| f.write(new_contents) } if needs_update?
  end

  def new_contents
    if contents =~ license_pattern
      contents.sub(license_pattern, license_comment)
    else
      with_new_license
    end
  end

  def with_new_license
    insert_point = license_insert_points.map { |re| contents.match(re) }.compact.first
    fail "No insert point matches for #{filename} from #{license_insert_points.inspect}" unless insert_point

    i = insert_point.end(0)

    contents.dup.insert(i, "#{"\n" if i != 0}#{license_comment}#{"\n" if contents.slice(i, 1) != "\n"}")
  end

  def license_pattern
    @license_pattern ||= begin
      re_string = license_header_lines.collect { |line|
        if line =~ LICENSE_TOKEN
          line_prefix = line.sub(/\s*#{LICENSE_TOKEN.source}\s*/, '')
          "(#{line_prefix}.*?\n)+?"
        else
          Regexp.escape(line) + "\n"
        end
      }.join('')

      Regexp.new(re_string, Regexp::MULTILINE)
    end
  end

  def license_comment
    license_header_lines.collect { |line|
      if line =~ LICENSE_TOKEN
        LICENSE_HEADER_TEXT.split("\n").collect { |l|
          line.sub(LICENSE_TOKEN, l).gsub(/\s*$/, '')
        }.join("\n") + "\n"
      else
        "#{line}\n"
      end
    }.join('')
  end
end

class JavaLicenseUpdater < LicenseUpdater
  def license_insert_points
    [ /\A/ ]
  end

  def license_header_lines
    [
      "/*L",
      " * {LICENSE}",
      " */"
    ]
  end
end

class RubyLicenseUpdater < LicenseUpdater
  def license_insert_points
    [
      %r{#!.*?\n},
      /\A/
    ]
  end

  def license_header_lines
    [
      "#L",
      "# {LICENSE}",
      "#L"
    ]
  end
end

class XmlLicenseUpdater < LicenseUpdater
  def license_insert_points
    [
      %r{<\?xml.*?\?>\s*?\n},
      /\A/
    ]
  end

  def license_header_lines
    [
      "<!--L",
      "  {LICENSE}",
      "L-->"
    ]
  end
end

class JspLicenseUpdater < LicenseUpdater
  def license_insert_points
    [
      /\A/
    ]
  end

  def license_header_lines
    [
      "<%--L",
      "  {LICENSE}",
      "L--%>"
    ]
  end
end

class SQLLicenseUpdater < LicenseUpdater
  def license_insert_points
    [
      /\A/
    ]
  end

  def license_header_lines
    [
      "/*L",
      "  {LICENSE}",
      "L*/"
    ]
  end
end

class PropertyLicenseUpdater < LicenseUpdater
  def license_insert_points
    [
      /\A/
    ]
  end

  def license_header_lines
    [
      "#L",
      "# {LICENSE}",
      "#L"
    ]
  end
end

###### MAIN EXECUTION

class LicenseCLI
  attr_reader :command

  def initialize(args)
    @command = args.pop
  end

  def run
    if command && respond_to?(command)
      send(command)
    elsif command
      fail "Unknown subcommand #{command.inspect}"
    else
      fail "Please specify update or check."
    end
  end

  def update
    outdated.each_with_index do |u, i|
      $stderr.print "\rUpdating #{i + 1} / #{outdated.size}"
      u.update
    end
    $stderr.puts "\rUpdated #{outdated.size} license header#{'s' unless outdated.size == 1}."
    exit(0)
  end

  def check
    if outdated.empty?
      $stderr.puts "All license headers up to date."
      exit(0)
    else
      $stderr.puts "#{outdated.size} files have missing or outdated license header#{'s' unless outdated.size == 1}:"
      outdated.collect(&:filename).sort.each do |fn|
        puts "   #{fn}"
      end
      exit(1)
    end
  end

  def outdated
    @outdated ||= updaters.select { |u| u.needs_update? }
  end

  def updaters
    @updaters ||= {
      "**/*.java" => JavaLicenseUpdater,
      "**/**/*.xml" => XmlLicenseUpdater,
      "**/**/*.jsp" => JspLicenseUpdater,
      "**/**/*.properties" => PropertyLicenseUpdater,
      "**/**/*.sql" => SQLLicenseUpdater
    }.collect { |pattern, updater_class|
      Dir[pattern].collect { |filename|
        updater_class.new(filename)
      }
    }.flatten
  end
end

LicenseCLI.new(ARGV).run
