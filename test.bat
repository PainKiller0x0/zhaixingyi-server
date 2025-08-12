@echo off
chcp 65001
title 一键部署后端代码脚本 (摘星译)
echo ====================================
echo Git 一键部署后端代码脚本 (摘星译)
echo ====================================
echo.

:: 检查当前目录是否是Git仓库
if not exist ".git" (
    echo 错误：当前目录不是一个Git仓库。请在正确的目录运行此脚本。
    echo.
    pause
    exit /b 1
)

echo ====================================
echo (1/3) 正在执行本地 Git 操作...
echo ====================================
echo.

:: 检查工作目录是否有改动
:: 使用 git status --porcelain 来获取简洁状态，如果输出为空，说明工作目录是干净的
git status --porcelain >nul 2>&1
if %errorlevel% neq 0 (
    echo >>> 没有需要提交的本地更改，正在直接进入远程部署。
    goto :remote_deploy
)

:: 提示用户输入提交信息
set /p commit_message="请输入本次提交的描述信息: "

:: 检查提交信息是否为空
if "%commit_message%"=="" (
    echo.
    echo 警告：提交信息不能为空，请重新运行脚本并输入描述。
    echo.
    pause
    exit /b 1
)

:: 1. 添加所有文件到暂存区
echo ^> git add .
git add .
if not %errorlevel%==0 (
    echo.
    echo 错误：git add 命令执行失败。
    echo.
    pause
    exit /b 1
)

:: 2. 提交到本地仓库
echo ^> git commit -m "%commit_message%"
git commit -m "%commit_message%"
if not %errorlevel%==0 (
    echo.
    echo 错误：git commit 命令执行失败。可能已有未提交的暂存文件。
    echo.
    pause
    exit /b 1
)

:: 3. 推送到远程仓库
echo ^> git push
git push
if not %errorlevel%==0 (
    echo.
    echo 错误：git push 命令执行失败。请检查网络连接或仓库配置。
    echo.
    pause
    exit /b 1
)

:remote_deploy
echo.
echo ====================================
echo (2/3) 本地操作完成，开始远程部署...
echo ====================================

:: 4. 通过SSH连接到远程服务器并执行命令
echo ^> ssh root@8.134.192.197 "cd /opt/zhaixingyi-backend && git pull origin master && pm2 restart zhaixingyi-api"
ssh root@8.134.192.197 "cd /opt/zhaixingyi-backend && git pull origin master && pm2 restart zhaixingyi-api"
if not %errorlevel%==0 (
    echo.
    echo 错误：远程部署命令执行失败。请检查SSH配置或服务器状态。
    echo.
    pause
    exit /b 1
)

echo.
echo ====================================
echo (3/3) 部署成功！
echo ====================================
echo.
echo 脚本执行完毕，按任意键退出。
pause